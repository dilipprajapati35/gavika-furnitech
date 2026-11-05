"use client";

import { supabase } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// Gavika Customer Account V2.6 — V2.4 safety architecture + V2.5 order tracking.

interface CustomProject {
  id: string;
  request_id: string;
  furniture_type: string | null;
  preferred_material: string | null;
  room_usage: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  delivery_location: string | null;
  status: string | null;
  created_at: string;
}

interface CustomerQuotation {
  id: string;
  request_id: string;
  quotation_number: string;
  amount: number;
  description: string | null;
  validity_days: number;
  status: "Pending" | "Approved" | "Rejected" | "Expired";
  created_at: string;
  updated_at: string;
  drawing_name: string | null;
  drawing_url: string | null;
  catalogue_design_name: string | null;
  catalogue_design_image_url: string | null;
  reference_image_url: string | null;
}

interface CustomerOrder {
  id: string;
  order_number: string;
  user_id: string;
  request_id: string;
  quotation_id: string;
  amount: number;

  status:
  | "Confirmed"
  | "Production"
  | "Quality Check"
  | "Ready"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";

  expected_delivery_date: string | null;
  delivery_address: string | null;

  created_at: string;
  updated_at: string;
  quotations?: {
    drawing_name: string | null;
    drawing_url: string | null;
  } | null;

  // Drawing from quotation
  drawing_name: string | null;
  drawing_url: string | null;

  // Selected furniture and customer reference image
  catalogue_design_name: string | null;
  catalogue_design_image_url: string | null;
  reference_image_url: string | null;
}

interface AccountCardProps {
  title: string;
  description: string;
  icon: string;
}

interface ProjectInfoProps {
  label: string;
  value: string | null;
}

const ORDER_STEPS = [
  "Confirmed",
  "Production",
  "Quality Check",
  "Ready",
  "Out for Delivery",
  "Delivered",
] as const;

function getStatusIndex(status: string) {
  return ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number]);
}

function formatDate(date: string | null) {
  if (!date) return "Not updated";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Not updated";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getStatusStyle(status: string) {
  switch (status) {
    case "Confirmed": return "bg-blue-100 text-blue-800";
    case "Production": return "bg-purple-100 text-purple-800";
    case "Quality Check": return "bg-yellow-100 text-yellow-800";
    case "Ready": return "bg-indigo-100 text-indigo-800";
    case "Out for Delivery": return "bg-orange-100 text-orange-800";
    case "Delivered": return "bg-green-100 text-green-800";
    case "Cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

export default function AccountPage() {
  const router = useRouter();

  const [userName, setUserName] = useState("Customer");
  const [userEmail, setUserEmail] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [accountCreated, setAccountCreated] = useState("");

  const [projects, setProjects] = useState<CustomProject[]>([]);
  const [quotations, setQuotations] = useState<
    Record<string, CustomerQuotation>
  >({});
  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [quotationsLoading, setQuotationsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: "success" | "danger" | "primary";
    onConfirm: () => Promise<void> | void;
    loading?: boolean;
  } | null>(null);

  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    orderNumber?: string;
  } | null>(null);

  // Quick Order Lookup by Order Number (Direct tracking)
  const [lookupOrderQuery, setLookupOrderQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<CustomerOrder | null>(null);
  const [lookupError, setLookupError] = useState("");

  // Storage URL resolver helper
  const resolveStorageUrl = useCallback(async (rawPath: string | null | undefined): Promise<string | null> => {
    if (!rawPath) return null;
    try {
      let storagePath = rawPath;
      if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
        const marker = "/storage/v1/object/";
        const markerIndex = rawPath.indexOf(marker);
        if (markerIndex === -1) {
          return rawPath;
        }
        const objectPath = rawPath.slice(markerIndex + marker.length).split("?")[0];
        const parts = objectPath.split("/");
        if (parts[0] === "public" || parts[0] === "sign" || parts[0] === "authenticated") {
          storagePath = parts.slice(2).join("/");
        }
      }
      const { data: signedData } = await supabase.storage
        .from("gavika-project-files")
        .createSignedUrl(storagePath, 60 * 60);
      return signedData?.signedUrl || rawPath;
    } catch {
      return rawPath;
    }
  }, []);

  const performLookup = useCallback(async (queryParam?: string) => {
    const q = (queryParam || lookupOrderQuery).trim();
    if (!q) return;

    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);

    try {
      const { data: orderRow, error: qErr } = await supabase
        .from("orders")
        .select("*")
        .ilike("order_number", `%${q}%`)
        .limit(1)
        .maybeSingle();

      if (qErr || !orderRow) {
        setLookupError(`No order found matching "${q}". Please verify the order number.`);
        return;
      }

      let rawReq: any = null;
      if (orderRow.request_id) {
        const { data: reqData } = await supabase
          .from("custom_requests")
          .select("catalogue_design_name, catalogue_design_image_url, reference_image_url, furniture_type")
          .eq("id", orderRow.request_id)
          .maybeSingle();
        rawReq = reqData;
      }

      let rawQuote: any = null;
      if (orderRow.quotation_id) {
        const { data: quoteData } = await supabase
          .from("quotations")
          .select("drawing_name, drawing_url")
          .eq("id", orderRow.quotation_id)
          .maybeSingle();
        rawQuote = quoteData;
      }

      let drawingUrl: string | null = null;
      if (rawQuote?.drawing_url) {
        drawingUrl = await resolveStorageUrl(rawQuote.drawing_url);
      }

      let refImgUrl: string | null = null;
      if (rawReq?.reference_image_url) {
        refImgUrl = await resolveStorageUrl(rawReq.reference_image_url);
      }

      setLookupResult({
        id: orderRow.id,
        order_number: orderRow.order_number,
        user_id: orderRow.user_id,
        request_id: orderRow.request_id,
        quotation_id: orderRow.quotation_id,
        amount: Number(orderRow.amount),
        status: orderRow.status,
        expected_delivery_date: orderRow.expected_delivery_date ?? null,
        delivery_address: orderRow.delivery_address ?? null,
        created_at: orderRow.created_at,
        updated_at: orderRow.updated_at,
        quotations: rawQuote || null,
        drawing_name: rawQuote?.drawing_name ?? null,
        drawing_url: drawingUrl,
        catalogue_design_name:
          rawReq?.catalogue_design_name ??
          rawReq?.furniture_type ??
          (orderRow as any).product_name ??
          "Gavika Handcrafted Furniture",
        catalogue_design_image_url: rawReq?.catalogue_design_image_url ?? null,
        reference_image_url: refImgUrl,
      });
    } catch (err: any) {
      setLookupError(err.message || "Failed to search for order.");
    } finally {
      setLookupLoading(false);
    }
  }, [lookupOrderQuery, resolveStorageUrl]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const orderParam = params.get("order");
      if (orderParam) {
        setLookupOrderQuery(orderParam);
        performLookup(orderParam);
      }
    }
  }, [performLookup]);

  const handleExecuteConfirm = async () => {
    if (!confirmModal) return;
    setConfirmModal((prev) => (prev ? { ...prev, loading: true } : null));
    try {
      await confirmModal.onConfirm();
    } finally {
      setConfirmModal(null);
    }
  };

  /*
   * ---------------------------------------------------------
   * AUTH / REQUEST SAFETY REFS
   * ---------------------------------------------------------
   */

  const currentUserIdRef = useRef<string | null>(null);

  const authLoadInProgressRef = useRef(false);

  const mountedRef = useRef(true);

  /*
   * If an auth event happens while a load is running,
   * remember that we need to verify the session again
   * after the current load finishes.
   */
  const authRefreshRequestedRef = useRef(false);

  /*
   * Every customer-data load gets a generation number.
   * Older requests are not allowed to overwrite newer state.
   */
  const dataLoadGenerationRef = useRef(0);

  /*
   * Prevents duplicate actions before React state updates.
   * This closes the small race window before setActionLoading().
   */
  const actionInProgressRef = useRef(false);

  /*
   * ---------------------------------------------------------
   * TIMEOUT HELPER
   * ---------------------------------------------------------
   */
  function withTimeout<T>(
    promise: PromiseLike<T>,
    timeoutMs: number,
    message: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(message));
      }, timeoutMs);

      Promise.resolve(promise).then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  /*
   * ---------------------------------------------------------
   * SUPABASE ERROR HELPER
   * ---------------------------------------------------------
   */

  function getSupabaseErrorMessage(error: unknown): string {
    if (!error) return "Unknown error";

    if (typeof error === "string") {
      return error;
    }

    if (typeof error === "object" && error !== null) {
      const e = error as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
      };

      return (
        [
          e.message,
          e.code ? `Code: ${e.code}` : "",
          e.details,
          e.hint,
        ]
          .filter(Boolean)
          .join(" | ") || "Unknown error"
      );
    }

    return String(error);
  }

  /*
   * ---------------------------------------------------------
   * LOAD PROJECTS
   * ---------------------------------------------------------
   */

  const loadProjects = useCallback(
    async (userId: string, loadGeneration: number): Promise<CustomProject[]> => {
      if (!mountedRef.current) return [];

      setProjectsLoading(true);

      try {
        const { data, error: projectsError } = await supabase
          .from("custom_requests")
          .select(`
            id,
            request_id,
            furniture_type,
            preferred_material,
            room_usage,
            length,
            width,
            height,
            delivery_location,
            status,
            created_at
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (projectsError) {
          console.error(
            "Customer requests error:",
            getSupabaseErrorMessage(projectsError)
          );

          if (
            mountedRef.current &&
            currentUserIdRef.current === userId &&
            dataLoadGenerationRef.current === loadGeneration
          ) {
            setError("Unable to load your custom projects.");
            setProjects([]);
            setQuotations({});
          }

          return [];
        }

        const loadedProjects = (data as CustomProject[]) || [];

        /*
         * Only the currently active user's latest request
         * may update project state.
         */
        if (
          mountedRef.current &&
          currentUserIdRef.current === userId &&
          dataLoadGenerationRef.current === loadGeneration
        ) {
          setProjects(loadedProjects);
        }

        return loadedProjects;
      } catch (err) {
        console.error(
          "Unexpected projects error:",
          getSupabaseErrorMessage(err)
        );

        if (
          mountedRef.current &&
          currentUserIdRef.current === userId &&
          dataLoadGenerationRef.current === loadGeneration
        ) {
          setError("Unable to load your custom projects.");
          setProjects([]);
          setQuotations({});
        }

        return [];
      } finally {
        if (
          mountedRef.current &&
          currentUserIdRef.current === userId &&
          dataLoadGenerationRef.current === loadGeneration
        ) {
          setProjectsLoading(false);
        }
      }
    },
    []
  );

  /*
   * ---------------------------------------------------------
   * LOAD QUOTATIONS
   * ---------------------------------------------------------
   */

  const loadQuotations = useCallback(
    async (
      userId: string,
      requestIds: string[],
      loadGeneration: number
    ) => {
      if (!mountedRef.current) return;

      setQuotationsLoading(true);

      try {
        if (requestIds.length === 0) {
          if (
            mountedRef.current &&
            currentUserIdRef.current === userId &&
            dataLoadGenerationRef.current === loadGeneration
          ) {
            setQuotations({});
          }

          return;
        }

        const { data, error: quotationError } = await supabase
          .from("quotations")
          .select(`
            id,
            request_id,
            quotation_number,
            amount,
            description,
            validity_days,
            status,
            created_at,
            updated_at,
            drawing_name,
            drawing_url
          `)
          .in("request_id", requestIds)
          .order("created_at", { ascending: false });

        if (quotationError) {
          console.error(
            "Quotation loading error:",
            getSupabaseErrorMessage(quotationError)
          );

          if (
            mountedRef.current &&
            currentUserIdRef.current === userId &&
            dataLoadGenerationRef.current === loadGeneration
          ) {
            setQuotations({});
          }

          return;
        }

        /*
         * Keep the latest quotation for each project.
         *
         * IMPORTANT:
         * The request IDs came from the current customer's
         * custom_requests result, so quotation data is scoped
         * through the customer's own projects.
         */
        const quotationMap: Record<string, CustomerQuotation> = {};

        for (const quotation of (data || []) as CustomerQuotation[]) {
          const currentQuotation = {
            ...quotation,
          } as CustomerQuotation;

          if (currentQuotation.drawing_url) {
            const isDirectUrl =
              currentQuotation.drawing_url.startsWith("http://") ||
              currentQuotation.drawing_url.startsWith("https://");

            if (!isDirectUrl) {
              const { data: signed, error: signedError } =
                await supabase.storage
                  .from("gavika-project-files")
                  .createSignedUrl(
                    currentQuotation.drawing_url,
                    60 * 60
                  );

              if (signedError) {
                console.error(
                  "Customer quotation drawing URL error:",
                  getSupabaseErrorMessage(signedError)
                );
              }

              if (signed?.signedUrl) {
                currentQuotation.drawing_url =
                  signed.signedUrl;
              }
            }
          }

          if (!quotationMap[currentQuotation.request_id]) {
            quotationMap[currentQuotation.request_id] =
              currentQuotation;
          }
        }

        /*
         * STALE USER GUARD
         *
         * Old customer's quotation response can never overwrite
         * the currently active customer's quotation state.
         */
        if (
          mountedRef.current &&
          currentUserIdRef.current === userId &&
          dataLoadGenerationRef.current === loadGeneration
        ) {
          setQuotations(quotationMap);
        }
      } catch (err) {
        console.error(
          "Unexpected quotation loading error:",
          getSupabaseErrorMessage(err)
        );

        if (
          mountedRef.current &&
          currentUserIdRef.current === userId &&
          dataLoadGenerationRef.current === loadGeneration
        ) {
          setQuotations({});
        }
      } finally {
        if (
          mountedRef.current &&
          currentUserIdRef.current === userId &&
          dataLoadGenerationRef.current === loadGeneration
        ) {
          setQuotationsLoading(false);
        }
      }
    },
    []
  );

  /*
   * ---------------------------------------------------------
   * LOAD ORDERS
   * ---------------------------------------------------------
   */

  const loadOrders = useCallback(
    async (userId: string, loadGeneration: number) => {
      if (!mountedRef.current) return;

      setOrdersLoading(true);

      try {
        let rawOrdersList: any[] = [];

        // 1. Direct query from orders table without fragile nested joins
        const { data: primaryData, error: ordersError } = await supabase
          .from("orders")
          .select(`
            id,
            order_number,
            user_id,
            request_id,
            quotation_id,
            amount,
            status,
            expected_delivery_date,
            delivery_address,
            created_at,
            updated_at
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!ordersError && primaryData && primaryData.length > 0) {
          rawOrdersList = primaryData;
        } else {
          // Fallback: direct select * by user_id
          const { data: fallbackData } = await supabase
            .from("orders")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (fallbackData && fallbackData.length > 0) {
            rawOrdersList = fallbackData;
          }
        }

        // 2. Also check if any orders exist for custom requests of this user where user_id was unlinked
        if (rawOrdersList.length === 0) {
          const { data: userReqs } = await supabase
            .from("custom_requests")
            .select("id")
            .eq("user_id", userId);

          if (userReqs && userReqs.length > 0) {
            const reqIds = userReqs.map((r) => r.id);
            const { data: reqOrders } = await supabase
              .from("orders")
              .select("*")
              .in("request_id", reqIds)
              .order("created_at", { ascending: false });

            if (reqOrders && reqOrders.length > 0) {
              rawOrdersList = reqOrders;
              for (const o of reqOrders) {
                if (!o.user_id) {
                  supabase.from("orders").update({ user_id: userId }).eq("id", o.id).then();
                }
              }
            }
          }
        }

        // 3. Format orders by safely resolving request & quotation data
        const formattedOrders: CustomerOrder[] = await Promise.all(
          rawOrdersList.map(async (order: any) => {
            let requestData: any = null;
            if (order.request_id) {
              const { data: rData } = await supabase
                .from("custom_requests")
                .select("catalogue_design_name, catalogue_design_image_url, reference_image_url, furniture_type")
                .eq("id", order.request_id)
                .maybeSingle();
              requestData = rData;
            }

            let quotationData: any = null;
            if (order.quotation_id) {
              const { data: qData } = await supabase
                .from("quotations")
                .select("drawing_name, drawing_url")
                .eq("id", order.quotation_id)
                .maybeSingle();
              quotationData = qData;
            }

            let drawingUrl: string | null = null;
            if (quotationData?.drawing_url) {
              drawingUrl = await resolveStorageUrl(quotationData.drawing_url);
            }

            let referenceImageUrl: string | null = null;
            if (requestData?.reference_image_url) {
              referenceImageUrl = await resolveStorageUrl(requestData.reference_image_url);
            }

            return {
              id: order.id,
              catalogue_design_name:
                requestData?.catalogue_design_name ??
                requestData?.furniture_type ??
                (order as any).product_name ??
                "Handcrafted Furniture Design",
              catalogue_design_image_url: requestData?.catalogue_design_image_url ?? null,
              reference_image_url: referenceImageUrl,
              order_number: order.order_number,
              user_id: order.user_id,
              request_id: order.request_id,
              quotation_id: order.quotation_id,
              amount: Number(order.amount),
              status: order.status,
              expected_delivery_date: order.expected_delivery_date ?? null,
              delivery_address: order.delivery_address ?? null,
              drawing_name: quotationData?.drawing_name ?? null,
              drawing_url: drawingUrl,
              created_at: order.created_at,
              updated_at: order.updated_at,
            };
          })
        );

        if (
          mountedRef.current &&
          currentUserIdRef.current === userId &&
          dataLoadGenerationRef.current === loadGeneration
        ) {
          setOrders(formattedOrders);
        }
      } catch (err) {
        console.error(
          "Unexpected orders loading error:",
          getSupabaseErrorMessage(err)
        );

        if (
          mountedRef.current &&
          currentUserIdRef.current === userId &&
          dataLoadGenerationRef.current === loadGeneration
        ) {
          setOrders([]);
        }
      } finally {
        if (
          mountedRef.current &&
          currentUserIdRef.current === userId &&
          dataLoadGenerationRef.current === loadGeneration
        ) {
          setOrdersLoading(false);
        }
      }
    },
    [resolveStorageUrl]
  );

  /*
   * ---------------------------------------------------------
   * LOAD ALL CUSTOMER DATA
   * ---------------------------------------------------------
   */

  const loadCustomerData = useCallback(
    async (userId: string, loadGeneration: number) => {
      /*
       * Projects first because quotations use project/request IDs.
       */
      const customerProjects = await loadProjects(
        userId,
        loadGeneration
      );

      if (
        !mountedRef.current ||
        currentUserIdRef.current !== userId ||
        dataLoadGenerationRef.current !== loadGeneration
      ) {
        return;
      }

      await loadQuotations(
        userId,
        customerProjects.map((project) => project.id),
        loadGeneration
      );
    },
    [loadProjects, loadQuotations]
  );

  /*
   * ---------------------------------------------------------
   * CHECK USER
   * ---------------------------------------------------------
   */

  const checkUser = useCallback(
    async (showFullLoading = true) => {
      /*
       * Prevent duplicate parallel auth loads.
       */
      if (authLoadInProgressRef.current) {
        authRefreshRequestedRef.current = true;
        return;
      }

      authLoadInProgressRef.current = true;

      const loadGeneration = dataLoadGenerationRef.current + 1;
      dataLoadGenerationRef.current = loadGeneration;

      if (showFullLoading && mountedRef.current) {
        setLoading(true);
      }

      try {
        const {
          data: { user },
          error: authError,
        } = await withTimeout(
          supabase.auth.getUser(),
          20000,
          "Account connection timed out. Please refresh and try again."
        );

        if (!mountedRef.current) return;

        if (authError) {
          console.error(
            "Account auth error:",
            getSupabaseErrorMessage(authError)
          );
          setError(
            "Unable to load your account. Please refresh or login again."
          );
          return;
        }

        if (!user) {
          currentUserIdRef.current = null;
          dataLoadGenerationRef.current += 1;
          setProjects([]);
          setQuotations({});
          setOrders([]);
          router.replace("/login");
          return;
        }

        /*
         * If the authenticated user changed, clear old customer's
         * visible data before loading the new customer's data.
         */
        if (
          currentUserIdRef.current &&
          currentUserIdRef.current !== user.id
        ) {
          setProjects([]);
          setQuotations({});
          setOrders([]);
        }

        currentUserIdRef.current = user.id;

        const name =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : "";

        setUserName(name || "Customer");
        setUserEmail(user.email || "");
        setCustomerId(`GF-CUS-${user.id.slice(0, 8).toUpperCase()}`);

        if (user.created_at) {
          setAccountCreated(
            new Date(user.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          );
        } else {
          setAccountCreated("");
        }

        setError("");

        /*
         * Data loads are bounded. If they time out, invalidate this
         * generation so late responses cannot overwrite current state.
         */
        await withTimeout(
          Promise.all([
            loadCustomerData(user.id, loadGeneration),
            loadOrders(user.id, loadGeneration),
          ]),
          20000,
          "Account data is taking too long to load. Please refresh and try again."
        );
      } catch (err) {
        /*
         * Invalidate any late responses from a timed-out load.
         */
        dataLoadGenerationRef.current += 1;

        if (mountedRef.current) {
          console.error(
            "Unexpected account error:",
            getSupabaseErrorMessage(err)
          );

          const message = getSupabaseErrorMessage(err);

          setError(
            message.includes("timed out")
              ? message
              : "Something went wrong. Please refresh the page."
          );
        }
      } finally {
        authLoadInProgressRef.current = false;

        if (showFullLoading && mountedRef.current) {
          setLoading(false);
        }

        /*
         * If an auth event arrived while this load was running,
         * verify the latest session after the current load finishes.
         */
        if (
          mountedRef.current &&
          authRefreshRequestedRef.current
        ) {
          authRefreshRequestedRef.current = false;

          try {
            const {
              data: { user: latestUser },
            } = await withTimeout(
              supabase.auth.getUser(),
              10000,
              "Session verification timed out."
            );

            if (!mountedRef.current) return;

            if (!latestUser) {
              currentUserIdRef.current = null;
              dataLoadGenerationRef.current += 1;
              setProjects([]);
              setQuotations({});
              setOrders([]);
              router.replace("/login");
              return;
            }

            /*
             * A same-user auth refresh can still contain updated metadata.
             * Refresh the lightweight profile fields without forcing
             * another full page load.
             */
            const latestName =
              typeof latestUser.user_metadata?.full_name === "string"
                ? latestUser.user_metadata.full_name.trim()
                : "";

            setUserName(latestName || "Customer");
            setUserEmail(latestUser.email || "");

            if (latestUser.created_at) {
              setAccountCreated(
                new Date(latestUser.created_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              );
            }

            if (latestUser.id !== currentUserIdRef.current) {
              void checkUser(true);
            }
          } catch (err) {
            if (mountedRef.current) {
              console.error(
                "Session refresh verification error:",
                getSupabaseErrorMessage(err)
              );
            }
          }
        }
      }
    },
    [router, loadCustomerData, loadOrders]
  );

  /*
   * ---------------------------------------------------------
   * AUTH STATE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    mountedRef.current = true;

    /*
     * Initial account load.
     */
    void checkUser(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;

        /*
         * Logout / no session.
         */
        if (
          event === "SIGNED_OUT" ||
          !session
        ) {
          currentUserIdRef.current = null;

          dataLoadGenerationRef.current += 1;

          setProjects([]);
          setQuotations({});
          setOrders([]);

          router.replace("/login");
          return;
        }

        /*
         * If a load is already running, DO NOT simply ignore
         * the event. Mark it for verification after the load.
         */
        if (authLoadInProgressRef.current) {
          authRefreshRequestedRef.current = true;
          return;
        }

        /*
         * Genuine user/session change.
         */
        if (session.user.id !== currentUserIdRef.current) {
          void checkUser(true);
          return;
        }

        /*
         * Same-user auth refresh: update lightweight profile fields
         * without reloading the whole account unnecessarily.
         */
        const refreshedName =
          typeof session.user.user_metadata?.full_name === "string"
            ? session.user.user_metadata.full_name.trim()
            : "";

        setUserName(refreshedName || "Customer");
        setUserEmail(session.user.email || "");
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [checkUser, router]);

  /*
   * ---------------------------------------------------------
   * LOGOUT
   * ---------------------------------------------------------
   */

  async function handleLogout() {
    setError("");
    setLoggingOut(true);

    try {
      /*
       * Invalidate current data generation immediately.
       */
      dataLoadGenerationRef.current += 1;

      const { error: logoutError } =
        await supabase.auth.signOut();

      if (logoutError) {
        console.error(
          "Logout error:",
          getSupabaseErrorMessage(logoutError)
        );

        if (mountedRef.current) {
          setError("Logout failed. Please try again.");
          setLoggingOut(false);
        }

        return;
      }

      currentUserIdRef.current = null;
      authRefreshRequestedRef.current = false;

      setProjects([]);
      setQuotations({});
      setOrders([]);

      router.replace("/login?logged_out=true");
    } catch (err) {
      console.error(
        "Unexpected logout error:",
        getSupabaseErrorMessage(err)
      );

      if (mountedRef.current) {
        setError("Logout failed. Please try again.");
        setLoggingOut(false);
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * QUOTATION APPROVE / REJECT
   * ---------------------------------------------------------
   */

  function handleQuotationDecision(
    quotationId: string,
    decision: "Approved" | "Rejected",
    projectId: string
  ) {
    if (actionInProgressRef.current) return;

    setConfirmModal({
      isOpen: true,
      title: decision === "Approved" ? "Approve Quotation" : "Reject Quotation",
      message:
        decision === "Approved"
          ? "Are you sure you want to approve this quotation? Once approved, our team will proceed with your custom furniture order."
          : "Are you sure you want to reject this quotation? You can request adjustments or submit a new requirement at any time.",
      confirmLabel: decision === "Approved" ? "Yes, Approve" : "Yes, Reject",
      variant: decision === "Approved" ? "success" : "danger",
      onConfirm: async () => {
        await executeQuotationDecision(quotationId, decision, projectId);
      },
    });
  }

  async function executeQuotationDecision(
    quotationId: string,
    decision: "Approved" | "Rejected",
    projectId: string
  ) {
    void projectId;

    /*
     * Lock synchronously BEFORE any await.
     */
    actionInProgressRef.current = true;
    setActionLoading(`quotation-${quotationId}`);
    setError("");

    let rpcSucceeded = false;

    try {
      const {
        data: { user },
        error: authError,
      } = await withTimeout(
        supabase.auth.getUser(),
        10000,
        "Session verification timed out. Please try again."
      );

      if (authError || !user) {
        setError("Your session has expired. Please login again.");
        router.replace("/login");
        return;
      }

      if (
        currentUserIdRef.current &&
        currentUserIdRef.current !== user.id
      ) {
        setError("Account session changed. Please refresh the page.");
        return;
      }

      const { error: rpcError } = await withTimeout(
        supabase.rpc("respond_to_quotation", {
          p_quotation_id: quotationId,
          p_decision: decision,
        }),
        20000,
        "Quotation action timed out. Please check your quotation status and try again."
      );

      if (rpcError) {
        console.error(
          "Quotation decision error:",
          getSupabaseErrorMessage(rpcError)
        );

        setError(
          rpcError.message ||
          `Unable to ${decision.toLowerCase()} quotation.`
        );
        return;
      }

      rpcSucceeded = true;

      /*
       * Use a fresh generation for action-triggered reload.
       * This prevents an older auth/data generation from invalidating
       * the refresh after a successful RPC.
       */
      const refreshGeneration =
        dataLoadGenerationRef.current + 1;

      dataLoadGenerationRef.current = refreshGeneration;

      try {
        await withTimeout(
          Promise.all([
            loadCustomerData(user.id, refreshGeneration),
            loadOrders(user.id, refreshGeneration),
          ]),
          20000,
          "Quotation was processed, but the latest data could not be refreshed."
        );
      } catch (reloadError) {
        console.error(
          "Quotation refresh error:",
          getSupabaseErrorMessage(reloadError)
        );

        /*
         * Do not tell the customer that the quotation action failed.
         * The RPC already succeeded.
         */
        setError(
          "Quotation processed successfully, but the latest account data could not be refreshed. Please refresh the page."
        );
      }
    } catch (err) {
      console.error(
        "Quotation decision error:",
        getSupabaseErrorMessage(err)
      );

      setError(
        rpcSucceeded
          ? "Quotation processed successfully, but the latest data could not be refreshed."
          : "Something went wrong while processing the quotation."
      );
    } finally {
      actionInProgressRef.current = false;

      if (mountedRef.current) {
        setActionLoading(null);
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * CONFIRM ORDER
   * ---------------------------------------------------------
   */

  function handleConfirmOrder(
    quotationId: string,
    projectId: string
  ) {
    if (actionInProgressRef.current) return;

    setConfirmModal({
      isOpen: true,
      title: "Confirm Custom Order",
      message: "Are you sure you want to place and confirm this custom furniture order?",
      confirmLabel: "Yes, Confirm Order",
      variant: "success",
      onConfirm: async () => {
        await executeConfirmOrder(quotationId, projectId);
      },
    });
  }

  async function executeConfirmOrder(
    quotationId: string,
    projectId: string
  ) {
    void projectId;

    /*
     * Lock synchronously BEFORE any await.
     */
    actionInProgressRef.current = true;
    setActionLoading(`order-${quotationId}`);
    setError("");

    let rpcSucceeded = false;
    let createdOrder: CustomerOrder | null = null;

    try {
      const {
        data: { user },
        error: authError,
      } = await withTimeout(
        supabase.auth.getUser(),
        10000,
        "Session verification timed out. Please try again."
      );

      if (authError || !user) {
        setError("Your session has expired. Please login again.");
        router.replace("/login");
        return;
      }

      if (
        currentUserIdRef.current &&
        currentUserIdRef.current !== user.id
      ) {
        setError("Account session changed. Please refresh the page.");
        return;
      }

      const {
        data,
        error: orderError,
      } = await withTimeout(
        supabase.rpc("create_order_from_quotation", {
          p_quotation_id: quotationId,
        }),
        20000,
        "Order creation timed out. Please check your orders before trying again."
      );

      if (orderError) {
        console.error(
          "Order creation error:",
          getSupabaseErrorMessage(orderError)
        );

        setError(
          orderError.message ||
          "Unable to create the order. Please try again."
        );
        return;
      }

      rpcSucceeded = true;

      /*
       * RPC may return either one object or an array with one row.
       */
      if (Array.isArray(data)) {
        createdOrder =
          (data[0] as CustomerOrder | undefined) || null;
      } else if (
        data &&
        typeof data === "object"
      ) {
        createdOrder = data as CustomerOrder;
      }

      /*
       * Fresh generation for post-action reload.
       */
      const refreshGeneration =
        dataLoadGenerationRef.current + 1;

      dataLoadGenerationRef.current = refreshGeneration;

      try {
        await withTimeout(
          Promise.all([
            loadCustomerData(user.id, refreshGeneration),
            loadOrders(user.id, refreshGeneration),
          ]),
          20000,
          "Order was created, but the latest account data could not be refreshed."
        );

        setSuccessModal({
          isOpen: true,
          title: "Order Placed Successfully!",
          message: "Thank you for confirming your order. Our team will start crafting your design.",
          orderNumber: createdOrder?.order_number || undefined,
        });
      } catch (reloadError) {
        console.error(
          "Order refresh error:",
          getSupabaseErrorMessage(reloadError)
        );

        /*
         * The order already exists in the database.
         * Do not present the reload failure as an order-creation failure.
         */
        setError(
          "Order created successfully, but the latest account data could not be refreshed. Please refresh the page."
        );

        setSuccessModal({
          isOpen: true,
          title: "Order Placed Successfully!",
          message: "Your order was created. Please refresh the page to see the latest order status.",
          orderNumber: createdOrder?.order_number || undefined,
        });
      }
    } catch (err) {
      console.error(
        "Confirm order error:",
        getSupabaseErrorMessage(err)
      );

      setError(
        rpcSucceeded
          ? "Order created successfully, but the latest data could not be refreshed."
          : "Something went wrong while creating the order."
      );
    } finally {
      actionInProgressRef.current = false;

      if (mountedRef.current) {
        setActionLoading(null);
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * UI HELPERS
   * ---------------------------------------------------------
   */

  function getOrderStatusClasses(status: string) {
    switch (status) {
      case "Confirmed":
        return "bg-blue-100 text-blue-800";

      case "Production":
        return "bg-orange-100 text-orange-800";

      case "Quality Check":
        return "bg-purple-100 text-purple-800";

      case "Ready":
        return "bg-green-100 text-green-800";

      case "Out for Delivery":
        return "bg-indigo-100 text-indigo-800";

      case "Delivered":
        return "bg-emerald-100 text-emerald-800";

      case "Cancelled":
        return "bg-red-100 text-red-800";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function getQuotationStatusClasses(
    status: string
  ) {
    switch (status) {
      case "Pending":
        return "bg-yellow-100 text-yellow-800";

      case "Approved":
        return "bg-green-100 text-green-800";

      case "Rejected":
        return "bg-red-100 text-red-800";

      case "Expired":
        return "bg-gray-100 text-gray-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function isQuotationExpired(
    quotation: CustomerQuotation
  ) {
    const expiryTime =
      new Date(quotation.created_at).getTime() +
      quotation.validity_days *
      24 *
      60 *
      60 *
      1000;

    return Date.now() >= expiryTime;
  }

  function getOrderForQuotation(
    quotationId: string
  ) {
    return orders.find(
      (order) =>
        order.quotation_id === quotationId
    );
  }

  /*
   * ---------------------------------------------------------
   * INITIAL LOADING
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5efe6] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 text-[#5a3927]">
            <span className="h-6 w-6 border-3 border-[#5a3927]/30 border-t-[#5a3927] rounded-full animate-spin" />

            <span className="text-lg">
              Loading your account...
            </span>
          </div>

          <p className="text-sm text-gray-500">
            This should take a few seconds
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5efe6]">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-[#ded5c8] bg-[#f8f5ef]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/Gavika-new-logo.png"
              alt="Gavika Furnitech"
              className="h-14 w-auto object-contain"
            />

            <div>
              <p className="text-xl font-semibold tracking-wide text-[#29251f]">
                Gavika Furnitech
              </p>
              <p className="text-xs tracking-[0.2em] text-[#8b6f47]">
                PREMIUM FURNITURE
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link href="/" className="hover:text-[#8b6f47] transition">
              Home
            </Link>

            <Link href="/furniture" className="hover:text-[#8b6f47] transition">
              Furniture
            </Link>

            <Link href="/custom-furniture" className="hover:text-[#8b6f47] transition">
              Custom Furniture
            </Link>

            <Link href="/#process" className="hover:text-[#8b6f47] transition">
              About
            </Link>

            <Link href="/#contact" className="hover:text-[#8b6f47] transition">
              Contact
            </Link>

            <div className="flex items-center gap-3">
              <span className="font-semibold text-[#8b6f47] flex items-center gap-1.5">
                <span>👤</span>
                <span>My Account</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-xs text-gray-400 hover:text-red-600 transition disabled:opacity-50"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg border border-[#ded5c8] px-3 py-2 text-xl"
            aria-label="Open menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#ded5c8] bg-[#f8f5ef] px-6 py-4">
            <nav className="flex flex-col gap-4 text-sm font-medium">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b6f47]"
              >
                Home
              </Link>

              <Link
                href="/furniture"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b6f47]"
              >
                Furniture
              </Link>

              <Link
                href="/custom-furniture"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b6f47]"
              >
                Custom Furniture
              </Link>

              <Link
                href="/#process"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b6f47]"
              >
                About
              </Link>

              <Link
                href="/#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b6f47]"
              >
                Contact
              </Link>

              <div className="flex flex-col gap-2 pt-2 border-t border-[#ded5c8]">
                <span className="font-semibold text-[#8b6f47]">
                  👤 My Account
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="text-left text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* MAIN */}

      <section className="max-w-7xl mx-auto px-6 py-10">
        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-lg">
                ⚠️
              </span>

              <div>
                <p className="font-medium">
                  Something went wrong
                </p>

                <p className="mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* WELCOME */}

        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-serif font-semibold text-[#3d281c]">
            Welcome, {userName}
          </h1>

          <p className="text-gray-600 mt-3 text-lg">
            Manage your orders, custom projects,
            quotations, and account.
          </p>
        </div>

        {/* ACCOUNT INFORMATION */}

        <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 mb-10">
          <h2 className="text-xl font-semibold text-[#3d281c] mb-6">
            Account Information
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Name
              </p>

              <p className="font-medium text-gray-900 mt-2 text-lg">
                {userName}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Customer ID
              </p>

              <p className="font-medium text-gray-900 mt-2 text-sm break-all">
                {customerId || "Not available"}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Email Address
              </p>

              <p
                className="font-medium text-gray-900 mt-2 text-lg truncate"
                title={userEmail}
              >
                {userEmail}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Account Status
              </p>

              <p className="font-medium text-green-700 mt-2 text-lg">
                ● Active
              </p>

              {accountCreated && (
                <p className="text-xs text-gray-500 mt-1">
                  Since {accountCreated}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* MY ORDERS */}

        <div className="mb-10">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#3d281c]">My Orders</h2>
            <p className="text-gray-600 text-sm mt-1">Track your furniture order from confirmation to delivery.</p>
          </div>

          {/* Quick Order Lookup by Order Number */}
          <div className="mb-6 p-4 rounded-2xl bg-white border border-[#e7dccd] shadow-xs">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                performLookup();
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={lookupOrderQuery}
                  onChange={(e) => setLookupOrderQuery(e.target.value)}
                  placeholder="Enter Order Number to track (e.g. ORD-123456-789)..."
                  className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-800 outline-none focus:border-[#7a5235]"
                />
              </div>
              <button
                type="submit"
                disabled={lookupLoading || !lookupOrderQuery.trim()}
                className="rounded-xl bg-[#3d281c] hover:bg-[#5a3927] text-white px-5 py-2.5 text-xs font-semibold transition disabled:opacity-50 shrink-0"
              >
                {lookupLoading ? "Tracking..." : "Track Order"}
              </button>
            </form>

            {lookupResult && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <span>✓</span> Found Live Order: {lookupResult.order_number}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLookupResult(null)}
                    className="text-[11px] text-gray-400 hover:text-gray-600"
                  >
                    Clear Result
                  </button>
                </div>
                <OrderTrackingCard order={lookupResult} />
              </div>
            )}

            {lookupError && (
              <p className="mt-2.5 text-xs text-rose-600 font-medium">{lookupError}</p>
            )}
          </div>

          {ordersLoading ? (
            <div className="bg-white rounded-2xl border border-[#e7dccd] p-8 text-center">
              <div className="inline-flex items-center gap-3 text-[#5a3927]">
                <span className="h-5 w-5 border-2 border-[#5a3927]/30 border-t-[#5a3927] rounded-full animate-spin" />
                <span>Loading your orders...</span>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-8 text-center">
              <div className="text-5xl mb-4">📦</div>
              <h3 className="text-lg font-semibold text-[#3d281c]">No Orders Yet</h3>
              <p className="text-gray-500 mt-2">Your confirmed orders will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {orders.map((order) => (
                <OrderTrackingCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>

        {/* CUSTOM PROJECTS */}

        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[#3d281c]">
                My Custom Projects
              </h2>

              <p className="text-gray-600 text-sm mt-1">
                Track your custom furniture
                requests, quotations, and orders.
              </p>
            </div>

            <Link
              href="/custom-furniture"
              className="rounded-lg bg-[#5a3927] text-white px-4 py-2 text-sm font-medium hover:bg-[#432a1e] transition"
            >
              + New Request
            </Link>
          </div>

          {projectsLoading ? (
            <div className="bg-white rounded-2xl border border-[#e7dccd] p-8 text-center">
              <div className="inline-flex items-center gap-3 text-[#5a3927]">
                <span className="h-5 w-5 border-2 border-[#5a3927]/30 border-t-[#5a3927] rounded-full animate-spin" />

                <span>
                  Loading your projects...
                </span>
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-8 text-center">
              <div className="text-5xl mb-4">
                🪑
              </div>

              <h3 className="text-lg font-semibold text-[#3d281c]">
                No Custom Projects Yet
              </h3>

              <p className="text-gray-500 mt-2">
                Submit a custom furniture request
                and your project will appear here.
              </p>

              <Link
                href="/custom-furniture"
                className="inline-block mt-5 rounded-lg bg-[#5a3927] text-white px-6 py-2.5 font-medium hover:bg-[#432a1e] transition"
              >
                Create Custom Request
              </Link>
            </div>
          ) : (
            <div className="grid gap-5">
              {projects.map((project) => {
                const quotation =
                  quotations[project.id];

                const relatedOrder = quotation
                  ? getOrderForQuotation(
                    quotation.id
                  )
                  : undefined;

                const quotationExpired =
                  quotation
                    ? isQuotationExpired(
                      quotation
                    )
                    : false;

                const quotationDisplayStatus =
                  quotationExpired &&
                    quotation.status ===
                    "Pending"
                    ? "Expired"
                    : quotation?.status;

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-7"
                  >
                    {/* PROJECT HEADER */}

                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-[#3d281c]">
                            {project.furniture_type ||
                              "Custom Furniture"}
                          </h3>

                          <span className="rounded-full bg-[#f5efe6] text-[#5a3927] px-3 py-1 text-xs font-semibold">
                            {project.status ||
                              "New"}
                          </span>
                        </div>

                        <p className="text-sm text-gray-500 mt-2">
                          Request ID:{" "}
                          <span className="font-semibold text-gray-700">
                            {project.request_id}
                          </span>
                        </p>
                      </div>

                      <div className="text-sm text-gray-500">
                        {new Date(
                          project.created_at
                        ).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </div>
                    </div>

                    {/* PROJECT DETAILS */}

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#eee4d8]">
                      <ProjectInfo
                        label="Material"
                        value={
                          project.preferred_material
                        }
                      />

                      <ProjectInfo
                        label="Room / Usage"
                        value={project.room_usage}
                      />

                      <ProjectInfo
                        label="Dimensions"
                        value={
                          project.length ||
                            project.width ||
                            project.height
                            ? `${project.length || "-"} × ${project.width ||
                            "-"
                            } × ${project.height ||
                            "-"
                            }`
                            : null
                        }
                      />

                      <ProjectInfo
                        label="Delivery Location"
                        value={
                          project.delivery_location
                        }
                      />
                    </div>

                    {/* QUOTATION */}

                    {quotationsLoading ? (
                      <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Checking quotation...
                      </div>
                    ) : quotation ? (
                      <div className="mt-6 rounded-xl border border-[#e7dccd] bg-[#faf7f2] p-5">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Quotation
                            </p>

                            <p className="text-lg font-semibold text-[#3d281c] mt-1">
                              {
                                quotation.quotation_number
                              }
                            </p>

                            <p className="text-2xl font-semibold text-[#5a3927] mt-2">
                              ₹
                              {Number(
                                quotation.amount
                              ).toLocaleString(
                                "en-IN"
                              )}
                            </p>

                            <p className="text-sm text-gray-500 mt-1">
                              Valid for{" "}
                              {
                                quotation.validity_days
                              }{" "}
                              days
                            </p>
                          </div>

                          <div className="flex flex-col items-start md:items-end gap-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getQuotationStatusClasses(
                                quotationDisplayStatus ||
                                quotation.status
                              )}`}
                            >
                              {
                                quotationDisplayStatus
                              }
                            </span>

                            {/* APPROVE / REJECT */}

                            {quotation.status ===
                              "Pending" &&
                              !quotationExpired &&
                              !relatedOrder && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      handleQuotationDecision(
                                        quotation.id,
                                        "Approved",
                                        project.id
                                      )
                                    }
                                    disabled={
                                      actionInProgressRef.current ||
                                      actionLoading ===
                                      `quotation-${quotation.id}`
                                    }
                                    className="rounded-lg bg-green-700 text-white px-4 py-2 text-sm font-medium hover:bg-green-800 disabled:opacity-50"
                                  >
                                    {actionLoading ===
                                      `quotation-${quotation.id}`
                                      ? "Processing..."
                                      : "Approve"}
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleQuotationDecision(
                                        quotation.id,
                                        "Rejected",
                                        project.id
                                      )
                                    }
                                    disabled={
                                      actionInProgressRef.current ||
                                      actionLoading ===
                                      `quotation-${quotation.id}`
                                    }
                                    className="rounded-lg border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}

                            {/* CONFIRM ORDER */}

                            {quotation.status ===
                              "Approved" &&
                              !relatedOrder &&
                              !quotationExpired && (
                                <button
                                  onClick={() =>
                                    handleConfirmOrder(
                                      quotation.id,
                                      project.id
                                    )
                                  }
                                  disabled={
                                    actionInProgressRef.current ||
                                    actionLoading ===
                                    `order-${quotation.id}`
                                  }
                                  className="rounded-lg bg-[#5a3927] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#432a1e] disabled:opacity-50"
                                >
                                  {actionLoading ===
                                    `order-${quotation.id}`
                                    ? "Creating Order..."
                                    : "Confirm Order"}
                                </button>
                              )}

                            {/* ORDER CREATED */}

                            {relatedOrder && (
                              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                                <p className="text-xs text-green-700 font-medium">
                                  Order Created
                                </p>

                                <p className="text-sm font-semibold text-green-800 mt-1">
                                  {
                                    relatedOrder.order_number
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* QUOTATION DESCRIPTION */}

                        {quotation.description && (
                          <div className="mt-5 pt-5 border-t border-[#e7dccd]">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Quotation Details
                            </p>

                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                              {
                                quotation.description
                              }
                            </p>
                          </div>
                        )}
                        {/* ADMIN DRAWING */}

                        {quotation.drawing_url && (
                          <div className="mt-5 pt-5 border-t border-[#e7dccd]">
                            <div className="rounded-xl border border-[#e7dccd] bg-[#faf7f2] p-5">

                              <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                  <p className="text-sm font-semibold text-[#3d281c]">
                                    Drawing from Gavika Furnitech
                                  </p>

                                  {quotation.drawing_name && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      {quotation.drawing_name}
                                    </p>
                                  )}
                                </div>

                                <span className="text-xs font-medium text-[#7a5235]">
                                  Included with quotation
                                </span>
                              </div>

                              <img
                                src={quotation.drawing_url}
                                alt={
                                  quotation.drawing_name ||
                                  "Drawing from Gavika Furnitech"
                                }
                                className="w-full max-h-[600px] object-contain rounded-xl border border-gray-200 bg-white"
                              />

                              <a
                                href={quotation.drawing_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex mt-4 rounded-lg bg-[#5a3927] px-4 py-2 text-sm font-medium text-white hover:bg-[#432a1e]"
                              >
                                Open Full Drawing ↗
                              </a>

                            </div>
                          </div>
                        )}

                        {/* ORDER STATUS */}

                        {relatedOrder && (
                          <div className="mt-5 pt-5 border-t border-[#e7dccd]">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  Order Status
                                </p>

                                <p className="text-sm font-semibold text-[#3d281c] mt-1">
                                  {
                                    relatedOrder.status
                                  }
                                </p>
                              </div>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold self-start ${getOrderStatusClasses(
                                  relatedOrder.status
                                )}`}
                              >
                                {
                                  relatedOrder.status
                                }
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-6 rounded-xl border border-dashed border-[#d8c8b7] bg-[#faf7f2] p-5">
                        <p className="text-sm text-gray-500">
                          Quotation has not been
                          created yet.
                        </p>
                      </div>
                    )}

                    {/* PROJECT FOOTER */}

                    <div className="mt-6 pt-5 border-t border-[#eee4d8]">
                      <p className="text-xs text-gray-400">
                        Your project details are
                        visible only to you.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ACCOUNT FEATURES */}

        <div>
          <h2 className="text-xl font-semibold text-[#3d281c] mb-6">
            Other Account Features
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AccountCard
              title="Payments"
              description="View your payment history and advance details."
              icon="💳"
            />

            <AccountCard
              title="Production"
              description="Track your furniture production progress."
              icon="🏭"
            />

            <AccountCard
              title="Delivery"
              description="View delivery tracking and logistics information."
              icon="🚚"
            />

            <AccountCard
              title="Messages"
              description="Chat with the Gavika Furnitech team directly."
              icon="💬"
            />

            <AccountCard
              title="Profile Settings"
              description="Manage your personal information and preferences."
              icon="👤"
            />
          </div>
        </div>

        {/* HELP */}

        <div className="mt-12 rounded-2xl border border-[#e7dccd] bg-white p-6 md:p-8">
          <h3 className="text-lg font-semibold text-[#3d281c] mb-3">
            Need Help?
          </h3>

          <p className="text-gray-600 mb-4">
            Contact our support team for any assistance
            with your orders or account.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:gavikafurnitech@gmail.com"
              className="inline-block rounded-lg bg-[#5a3927] text-white px-6 py-2 font-medium hover:bg-[#432a1e] transition"
            >
              Email Support
            </a>

            <a
              href="tel:+918619906867"
              className="inline-block rounded-lg border border-[#5a3927] text-[#5a3927] px-6 py-2 font-medium hover:bg-[#5a3927]/5 transition"
            >
              Call Us
            </a>
          </div>
        </div>
      </section>

      {/* Custom Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div
          onClick={() => !confirmModal.loading && setConfirmModal(null)}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#23170f]/60 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl border border-[#e7dccd] text-center relative overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Top Close Button */}
            <button
              type="button"
              disabled={confirmModal.loading}
              onClick={() => setConfirmModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-[#f7f2ea] transition"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Icon */}
            <div
              className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm border ${confirmModal.variant === "success"
                  ? "bg-green-50 border-green-100 text-green-600"
                  : confirmModal.variant === "danger"
                    ? "bg-red-50 border-red-100 text-red-600"
                    : "bg-[#f7f2ea] border-[#ded5c8] text-[#3d281c]"
                }`}
            >
              {confirmModal.variant === "success" ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : confirmModal.variant === "danger" ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>

            {/* Title & Description */}
            <h3 className="text-xl font-serif font-semibold text-[#3d281c]">
              {confirmModal.title}
            </h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-sm mx-auto">
              {confirmModal.message}
            </p>

            {/* Action Buttons */}
            <div className="mt-7 grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={confirmModal.loading}
                onClick={() => setConfirmModal(null)}
                className="w-full py-3 px-4 rounded-xl border border-[#ded5c8] bg-white text-sm font-semibold text-gray-700 hover:bg-[#f7f2ea] hover:border-[#cfc4b4] transition active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmModal.loading}
                onClick={handleExecuteConfirm}
                className={`w-full py-3 px-4 rounded-xl active:scale-[0.98] text-sm font-semibold text-white shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 ${confirmModal.variant === "success"
                    ? "bg-[#2e7d32] hover:bg-[#1b5e20] shadow-green-900/20"
                    : confirmModal.variant === "danger"
                      ? "bg-red-600 hover:bg-red-700 shadow-red-600/25"
                      : "bg-[#3d281c] hover:bg-[#2a1a11] shadow-[#3d281c]/25"
                  }`}
              >
                {confirmModal.loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{confirmModal.confirmLabel}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Modal */}
      {successModal && successModal.isOpen && (
        <div
          onClick={() => setSuccessModal(null)}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#23170f]/60 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl border border-[#e7dccd] text-center relative overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="mx-auto w-16 h-16 rounded-2xl bg-green-50 border border-green-100 text-green-600 flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-xl font-serif font-semibold text-[#3d281c]">
              {successModal.title}
            </h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              {successModal.message}
            </p>

            {successModal.orderNumber && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#fbf8f4] border border-[#e7dccd] text-xs font-semibold text-[#3d281c]">
                <span>Order Ref:</span>
                <span className="font-mono text-[#8b5e3c]">{successModal.orderNumber}</span>
              </div>
            )}

            <div className="mt-6 pt-2">
              <button
                type="button"
                onClick={() => setSuccessModal(null)}
                className="w-full py-3 px-4 rounded-xl bg-[#3d281c] hover:bg-[#2a1a11] text-sm font-semibold text-white shadow-lg transition active:scale-[0.98]"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/*
 * ---------------------------------------------------------
 * PROJECT INFO
 * ---------------------------------------------------------
 */

function ProjectInfo({
  label,
  value,
}: ProjectInfoProps) {
  return (
    <div className="rounded-xl bg-[#faf7f2] p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>

      <p className="text-sm font-medium text-gray-900 mt-2">
        {value || "Not specified"}
      </p>
    </div>
  );
}

/*
 * =========================================================
 * ORDER TRACKING CARD
 * =========================================================
 */

function OrderTrackingCard({
  order,
}: {
  order: CustomerOrder;
}) {
  const isCancelled = order.status === "Cancelled";

  const currentIndex = getStatusIndex(order.status);

  return (
    <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-7">

      {/* =========================================================
          ORDER HEADER
      ========================================================= */}

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">

        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Order Number
          </p>

          <h3 className="text-xl font-semibold text-[#3d281c] mt-1">
            {order.order_number}
          </h3>

          <p className="text-sm text-gray-500 mt-2">
            Order Date: {formatDate(order.created_at)}
          </p>
        </div>

        <span
          className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
            order.status
          )}`}
        >
          {order.status}
        </span>

      </div>

      {/* SELECTED FURNITURE DESIGN */}

      {order.catalogue_design_name && (
        <div className="mt-6 rounded-xl border border-[#e7dccd] bg-[#faf7f2] p-4">
          <h4 className="font-semibold text-[#3d281c]">
            Selected Furniture Design
          </h4>

          {order.catalogue_design_image_url && (
            <img
              src={order.catalogue_design_image_url}
              alt={order.catalogue_design_name}
              className="mt-3 w-full max-h-72 rounded-lg border border-gray-200 bg-white object-contain"
            />
          )}

          <p className="mt-3 font-medium text-[#3d281c]">
            {order.catalogue_design_name}
          </p>
        </div>
      )}

      {/* CUSTOMER REFERENCE IMAGE */}

      {order.reference_image_url && (
        <div className="mt-4 rounded-xl border border-[#e7dccd] p-4">
          <h4 className="font-semibold text-[#3d281c]">
            Your Reference Image
          </h4>

          <img
            src={order.reference_image_url}
            alt="Customer reference"
            className="mt-3 w-full max-h-72 rounded-lg border border-gray-200 bg-white object-contain"
          />
        </div>
      )}

      {/* =========================================================
          ORDER PROGRESS
      ========================================================= */}

      {!isCancelled ? (
        <div className="mt-8">

          <p className="text-sm font-semibold text-[#3d281c] mb-5">
            Order Progress
          </p>

          {/* Desktop Timeline */}
          <div className="hidden md:block overflow-x-auto pb-3">
            <div className="min-w-[700px]">
              <div className="relative">
                {/* Background Line */}
                <div className="absolute left-0 right-0 top-4 h-1 bg-[#e7dccd]" />

                {/* Progress Line */}
                <div
                  className="absolute left-0 top-4 h-1 bg-[#5a3927] transition-all duration-500"
                  style={{
                    width:
                      currentIndex <= 0
                        ? "0%"
                        : `${(currentIndex /
                          (ORDER_STEPS.length - 1)) *
                        100
                        }%`,
                  }}
                />

                {/* Steps */}
                <div className="relative flex justify-between">
                  {ORDER_STEPS.map(
                    (step, index) => {
                      const completed =
                        currentIndex >= index;

                      const active =
                        currentIndex === index;

                      return (
                        <div
                          key={step}
                          className="flex flex-col items-center w-28"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold z-10 ${completed
                                ? "bg-[#5a3927] border-[#5a3927] text-white"
                                : "bg-white border-[#d8cbbb] text-gray-400"
                              } ${active
                                ? "ring-4 ring-[#5a3927]/10"
                                : ""
                              }`}
                          >
                            {completed && !active
                              ? "✓"
                              : index + 1}
                          </div>

                          <span
                            className={`text-xs text-center mt-3 ${completed
                                ? "font-semibold text-[#3d281c]"
                                : "text-gray-400"
                              }`}
                          >
                            {step}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Grid Timeline */}
          <div className="md:hidden pt-1">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {ORDER_STEPS.map((step, index) => {
                const completed = currentIndex >= index;
                const active = currentIndex === index;

                return (
                  <div
                    key={step}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                      active
                        ? "bg-[#3d281c] text-white border-[#3d281c] font-semibold shadow-2xs"
                        : completed
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-medium"
                        : "bg-white text-gray-400 border-gray-200"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        active
                          ? "bg-white text-[#3d281c]"
                          : completed
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {completed && !active ? "✓" : index + 1}
                    </div>
                    <span className="truncate text-xs">{step}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      ) : (

        /* =========================================================
           CANCELLED ORDER
        ========================================================= */

        <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5">

          <div className="flex gap-3">

            <span className="text-xl">
              ⚠️
            </span>

            <div>

              <p className="font-semibold text-red-800">
                Order Cancelled
              </p>

              <p className="text-sm text-red-700 mt-1">
                This order is no longer active.
                Please contact Gavika Furnitech
                support if you need assistance.
              </p>

            </div>

          </div>

        </div>
      )}


      {/* =========================================================
          ORDER INFORMATION
      ========================================================= */}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-7 pt-6 border-t border-[#eee4d8]">

        <ProjectInfo
          label="Order Amount"
          value={`₹${Number(order.amount).toLocaleString(
            "en-IN"
          )}`}
        />

        <ProjectInfo
          label="Request ID"
          value={order.request_id}
        />

        <ProjectInfo
          label="Expected Delivery"
          value={
            order.expected_delivery_date
              ? formatDate(
                order.expected_delivery_date
              )
              : "Not updated"
          }
        />

        <ProjectInfo
          label="Last Updated"
          value={formatDate(order.updated_at)}
        />

      </div>


      {/* =========================================================
          DELIVERY ADDRESS
      ========================================================= */}

      <div className="mt-4 rounded-xl bg-[#faf7f2] p-4">

        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Delivery Address
        </p>

        <p className="text-sm font-medium text-gray-900 mt-2 whitespace-pre-wrap">
          {order.delivery_address ||
            "Delivery address not updated yet."}
        </p>

      </div>


      {/* =========================================================
          REFERENCE DRAWING
      ========================================================= */}

      {order.drawing_url && (

        <div className="mt-5 rounded-xl border border-[#e7dccd] bg-[#faf7f2] p-5">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            <div>

              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Reference Drawing
              </p>

              {order.drawing_name && (
                <p className="text-sm font-medium text-[#3d281c] mt-1">
                  {order.drawing_name}
                </p>
              )}

            </div>


            {/* OPEN DRAWING */}

            <a
              href={order.drawing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-[#5a3927] px-4 py-2 text-sm font-medium text-white hover:bg-[#432a1e]"
            >
              View Drawing ↗
            </a>

          </div>


          {/* =====================================================
              DRAWING PREVIEW
          ===================================================== */}

          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">

            <img
              src={order.drawing_url}
              alt={
                order.drawing_name ||
                "Reference drawing"
              }
              className="w-full max-h-[500px] object-contain rounded-lg"
            />

          </div>

        </div>

      )}



    </div>
  );
}

/*
 * ---------------------------------------------------------
 * ACCOUNT CARD
 * ---------------------------------------------------------
 */

function AccountCard({
  title,
  description,
  icon,
}: AccountCardProps) {
  return (
    <div className="rounded-2xl border border-[#e7dccd] bg-gray-50 shadow-sm p-6 opacity-70">
      <div className="text-4xl mb-4">
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-[#3d281c]">
        {title}
      </h3>

      <p className="text-sm text-gray-500 mt-3">
        {description}
      </p>

      <span className="inline-block mt-5 text-xs font-medium text-gray-400 uppercase tracking-wide">
        ⏳ Coming Soon
      </span>
    </div>
  );
}