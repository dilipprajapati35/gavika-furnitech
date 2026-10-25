"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type CustomRequest = {
  id: string;
  request_id: string;
  full_name: string;
  mobile: string;
  email: string | null;
  furniture_type: string;
  room_usage: string | null;
  preferred_material: string | null;
  requirement: string | null;
  delivery_location: string | null;
  status: string;
  created_at: string;
  reference_image_url: string | null;

  catalogue_design_id: string | null;
  catalogue_design_name: string | null;
  catalogue_design_image_url: string | null;
};

type Quotation = {
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
};

type QuotationForm = {
  amount: string;
  description: string;
  validity_days: string;
  drawing_name: string;
  drawing_file: File | null;
};

type MessageState = {
  type: "success" | "error";
  text: string;
};

export default function AdminDashboard() {
  const router = useRouter();

  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [quotations, setQuotations] = useState<Record<string, Quotation>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedRequest, setSelectedRequest] =
    useState<CustomRequest | null>(null);

  const [selectedQuotation, setSelectedQuotation] =
    useState<Quotation | null>(null);

  const [quotationMode, setQuotationMode] = useState<"create" | "view">(
    "create"
  );

  const [quotationForm, setQuotationForm] = useState<QuotationForm>({
    amount: "",
    description: "",
    validity_days: "7",
    drawing_name: "",
    drawing_file: null,
  });

  const [quotationLoading, setQuotationLoading] = useState(false);

  const [quotationMessage, setQuotationMessage] =
    useState<MessageState | null>(null);

  async function getStorageSignedUrl(path: string | null) {
    if (!path) return null;

    const bucketName = "gavika-project-files";
    let storagePath = path;

    if (path.startsWith("http://") || path.startsWith("https://")) {
      const marker = "/storage/v1/object/";
      const markerIndex = path.indexOf(marker);

      if (markerIndex === -1) {
        console.error("Invalid Storage URL:", path);
        return null;
      }

      const objectPath = path
        .slice(markerIndex + marker.length)
        .split("?")[0];

      const parts = objectPath.split("/");

      if (
        parts[0] !== "public" &&
        parts[0] !== "sign" &&
        parts[0] !== "authenticated"
      ) {
        console.error("Unknown Storage URL format:", path);
        return null;
      }

      storagePath = parts.slice(2).join("/");
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 60 * 60);

    if (error) {
      console.error("Storage signed URL error:", error.message);
      return null;
    }

    return data?.signedUrl ?? null;
  }

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setError(
          "Unable to verify your admin session. Please refresh and try again."
        );
        return;
      }

      if (!user) {
        router.push("/admin");
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) {
        setError(
          "Unable to verify admin access. Please refresh and try again."
        );
        return;
      }

      if (!adminUser) {
        await supabase.auth.signOut();
        router.push("/admin");
        return;
      }

      const [requestsResult, quotationsResult] = await Promise.all([
        supabase
         .from("custom_requests")
          .select(`
          id,
          request_id,
          full_name,
          mobile,
          email,
          furniture_type,
          room_usage,
          preferred_material,
          requirement,
          delivery_location,
          status,
          created_at,
          reference_image_url,
          catalogue_design_id,
          catalogue_design_name,
          catalogue_design_image_url
        `)
          .order("created_at", { ascending: false }),

        supabase
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
          .order("created_at", { ascending: false }),
      ]);

      if (requestsResult.error) {
        setError(
          "Unable to load customer requests. Please refresh and try again."
        );
        return;
      }

      if (quotationsResult.error) {
        setError(
          "Unable to load quotations. Please refresh and try again."
        );
        return;
      }

      const requestsWithSignedImages = await Promise.all(
        ((requestsResult.data || []) as CustomRequest[]).map(async (request) => ({
          ...request,
          reference_image_url: await getStorageSignedUrl(request.reference_image_url),
        }))
      );

      const quotationMap: Record<string, Quotation> = {};
      for (const quotation of (quotationsResult.data || []) as Quotation[]) {
        if (!quotationMap[quotation.request_id]) {
          quotationMap[quotation.request_id] = {
            ...quotation,
            drawing_url: await getStorageSignedUrl(quotation.drawing_url),
          };
        }
      }

      setRequests(requestsWithSignedImages);
      setQuotations(quotationMap);
    } catch {
      setError(
        "Something went wrong while loading requests. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleLogout() {
    try {
      const { error: logoutError } = await supabase.auth.signOut();

      if (logoutError) {
        setError("Unable to logout. Please try again.");
        return;
      }

      router.push("/admin");
    } catch {
      setError("Unable to logout. Please try again.");
    }
  }

  function openCreateQuotation(request: CustomRequest) {
    const existingQuotation = quotations[request.id];

    /*
      If quotation exists and is not rejected,
      open it in view mode instead of creating another one.
    */
    if (
      existingQuotation &&
      existingQuotation.status !== "Rejected" &&
      existingQuotation.status !== "Expired"
    ) {
      openViewQuotation(request, existingQuotation);
      return;
    }

    setSelectedRequest(request);
    setSelectedQuotation(null);
    setQuotationMode("create");

    setQuotationForm({
      amount: "",
      description: `Custom ${request.furniture_type} as per customer requirement.`,
      validity_days: "7",
      drawing_name: "",
      drawing_file: null,
    });

    setQuotationMessage(null);
  }

  async function openViewQuotation(
    request: CustomRequest,
    quotation: Quotation
  ) {
    let quotationForView = { ...quotation };

    if (
      quotationForView.drawing_url &&
      !quotationForView.drawing_url.startsWith("http://") &&
      !quotationForView.drawing_url.startsWith("https://")
    ) {
      const { data: signed, error: signedError } =
        await supabase.storage
          .from("gavika-project-files")
          .createSignedUrl(
            quotationForView.drawing_url,
            60 * 60
          );

      if (signedError) {
        console.error(
          "Drawing signed URL error:",
          signedError
        );
      }

      if (signed?.signedUrl) {
        quotationForView.drawing_url = signed.signedUrl;
      }
    }

    setSelectedRequest(request);
    setSelectedQuotation(quotationForView);
    setQuotationMode("view");
    setQuotationMessage(null);
  }

  function closeQuotation() {
    if (quotationLoading) return;

    setSelectedRequest(null);
    setSelectedQuotation(null);
    setQuotationMessage(null);
    setQuotationMode("create");
  }

  async function createQuotation() {
    if (!selectedRequest) return;

    setQuotationMessage(null);

    const amount = Number(quotationForm.amount);
    const validityDays = Number(quotationForm.validity_days);

    if (!quotationForm.amount.trim()) {
      setQuotationMessage({
        type: "error",
        text: "Please enter the quotation amount.",
      });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setQuotationMessage({
        type: "error",
        text: "Please enter a valid quotation amount.",
      });
      return;
    }

    if (
      !Number.isInteger(validityDays) ||
      validityDays < 1 ||
      validityDays > 365
    ) {
      setQuotationMessage({
        type: "error",
        text: "Quotation validity must be between 1 and 365 days.",
      });
      return;
    }

    setQuotationLoading(true);

    try {
      if (!quotationForm.drawing_file) {
        setQuotationMessage({ type: "error", text: "Please select the drawing file." });
        setQuotationLoading(false);
        return;
      }
      const drawingFile = quotationForm.drawing_file;
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(drawingFile.type)) {
        setQuotationMessage({ type: "error", text: "Drawing must be JPG, PNG, WEBP or PDF." });
        setQuotationLoading(false);
        return;
      }
      if (drawingFile.size > 15 * 1024 * 1024) {
        setQuotationMessage({ type: "error", text: "Drawing file must be smaller than 15 MB." });
        setQuotationLoading(false);
        return;
      }
      const extension = drawingFile.name.split(".").pop()?.toLowerCase() || "bin";
      const drawingPath = `drawings/${selectedRequest.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("gavika-project-files").upload(drawingPath, drawingFile, { contentType: drawingFile.type, upsert: false });
      if (uploadError) {
        setQuotationMessage({ type: "error", text: `Drawing upload failed: ${uploadError.message}` });
        setQuotationLoading(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage
        .from("gavika-project-files")
        .getPublicUrl(drawingPath);

      const drawingUrl = publicUrlData.publicUrl;
      const drawingName = quotationForm.drawing_name.trim() || drawingFile.name;
      const { data, error: rpcError } = await supabase.rpc(
        "create_quotation",
        {
          p_request_id: selectedRequest.id,
          p_amount: amount,
          p_description: quotationForm.description.trim() || null,
          p_validity_days: validityDays,
          p_drawing_name: drawingName,
          p_drawing_url: drawingUrl,
        }
      );

      if (rpcError || !data) {
        setQuotationMessage({
          type: "error",
          text:
            rpcError?.message ||
            "Quotation could not be created. Please try again.",
        });
        return;
      }

      const newQuotation = data as Quotation;

      /*
        Save the new quotation locally so the dashboard
        immediately changes from Create to View.
      */
      setQuotations((currentQuotations) => ({
        ...currentQuotations,
        [selectedRequest.id]: newQuotation,
      }));

      setQuotationMessage({
        type: "success",
        text: `Quotation ${newQuotation.quotation_number} created successfully.`,
      });

      /*
        Update request status immediately.
      */
      setRequests((currentRequests) =>
        currentRequests.map((request) =>
          request.id === selectedRequest.id
            ? {
                ...request,
                status: "Quotation Sent",
              }
            : request
        )
      );

      /*
        After successful creation, switch modal
        to View Quotation mode.
      */
      setSelectedQuotation(newQuotation);
      setQuotationMode("view");
    } catch {
      setQuotationMessage({
        type: "error",
        text: "Something went wrong while creating the quotation.",
      });
    } finally {
      setQuotationLoading(false);
    }
  }

  function getStatusClasses(status: string) {
    switch (status) {
      case "New":
        return "bg-blue-100 text-blue-800";

      case "Quotation Sent":
        return "bg-purple-100 text-purple-800";

      case "Approved":
        return "bg-green-100 text-green-800";

      case "Rejected":
        return "bg-red-100 text-red-800";

      case "In Progress":
        return "bg-orange-100 text-orange-800";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function getQuotationStatusClasses(status: string) {
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

  const newRequests = requests.filter(
    (request) => request.status === "New"
  ).length;

  const inProgressRequests = requests.filter(
    (request) =>
      request.status !== "New" &&
      request.status !== "Quotation Sent"
  ).length;

  return (
    <main className="min-h-screen bg-[#f5efe6]">
      {/* Header */}
      <header className="bg-[#3d281c] text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-semibold">
              Gavika Furnitech
            </h1>

            <p className="text-sm text-white/70">
              Admin Dashboard
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Dashboard */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-serif font-semibold text-[#3d281c]">
            Customer Requests
          </h2>

          <p className="text-gray-600 mt-1">
            Custom furniture requests received from customers.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e7dccd]">
            <p className="text-sm text-gray-500">
              Total Requests
            </p>

            <p className="text-3xl font-semibold text-[#3d281c] mt-2">
              {requests.length}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e7dccd]">
            <p className="text-sm text-gray-500">
              New Requests
            </p>

            <p className="text-3xl font-semibold text-[#3d281c] mt-2">
              {newRequests}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e7dccd]">
            <p className="text-sm text-gray-500">
              In Progress
            </p>

            <p className="text-3xl font-semibold text-[#3d281c] mt-2">
              {inProgressRequests}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 text-red-700 p-4">
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>

              <button
                onClick={loadRequests}
                className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-sm hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-[#e7dccd] overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-[#3d281c]">
              Custom Furniture Requests
            </h3>

            <button
              onClick={loadRequests}
              disabled={loading}
              className="text-sm px-4 py-2 rounded-lg border border-[#7a5235] text-[#7a5235] hover:bg-[#f5efe6] disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              No customer requests found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#faf7f2]">
                  <tr>
                    <th className="text-left px-6 py-4">
                      Request ID
                    </th>

                    <th className="text-left px-6 py-4">
                      Customer
                    </th>

                    <th className="text-left px-6 py-4">
                      Furniture
                    </th>

                    <th className="text-left px-6 py-4">
                      Material
                    </th>

                    <th className="text-left px-6 py-4">
                      Location
                    </th>

                    <th className="text-left px-6 py-4">
                      Status
                    </th>

                    <th className="text-left px-6 py-4">
                      Date
                    </th>

                    <th className="text-left px-6 py-4">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((request) => {
                    const quotation = quotations[request.id];

                    const canCreateQuotation =
                      !quotation ||
                      quotation.status === "Rejected" ||
                      quotation.status === "Expired";

                    return (
                      <tr
                        key={request.id}
                        className="border-t border-gray-100 hover:bg-[#faf7f2]"
                      >
                        <td className="px-6 py-4 font-medium text-[#7a5235]">
                          {request.request_id}
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {request.full_name}
                          </div>

                          <div className="text-gray-500">
                            {request.mobile}
                          </div>

                          {request.email && (
                            <div className="text-gray-400 text-xs">
                              {request.email}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {request.furniture_type}
                        </td>

                        <td className="px-6 py-4">
                          {request.preferred_material || "-"}
                        </td>

                        <td className="px-6 py-4">
                          {request.delivery_location || "-"}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                              request.status
                            )}`}
                          >
                            {request.status}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(
                            request.created_at
                          ).toLocaleDateString("en-IN")}
                        </td>

                        <td className="px-6 py-4">
                          {canCreateQuotation ? (
                            <button
                              onClick={() =>
                                openCreateQuotation(request)
                              }
                              className="whitespace-nowrap rounded-lg bg-[#5a3927] text-white px-4 py-2 text-xs font-medium hover:bg-[#432a1e] transition"
                            >
                              {quotation
                                ? "Create New Quotation"
                                : "Create Quotation"}
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                openViewQuotation(
                                  request,
                                  quotation
                                )
                              }
                              className="whitespace-nowrap rounded-lg border border-[#7a5235] text-[#7a5235] px-4 py-2 text-xs font-medium hover:bg-[#f5efe6] transition"
                            >
                              View Quotation
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Quotation Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-serif font-semibold text-[#3d281c]">
                    {quotationMode === "view"
                      ? "Quotation Details"
                      : selectedQuotation
                      ? "Create New Quotation"
                      : "Create Quotation"}
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    Request: {selectedRequest.request_id}
                  </p>
                </div>

                <button
                  onClick={closeQuotation}
                  disabled={quotationLoading}
                  className="text-gray-400 hover:text-gray-700 text-xl disabled:opacity-50"
                  aria-label="Close quotation modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* View Existing Quotation */}
            {quotationMode === "view" && selectedQuotation ? (
              <div className="px-6 py-6 space-y-5">

                {/* Customer */}
                <div className="rounded-lg bg-[#faf7f2] p-4">
                  <p className="text-xs text-gray-500">
                    Customer
                  </p>

                  <p className="font-medium text-gray-900 mt-1">
                    {selectedRequest.full_name}
                  </p>

                  <p className="text-sm text-gray-500">
                    {selectedRequest.furniture_type}
                  </p>

                  {selectedRequest.preferred_material && (
                    <p className="text-sm text-gray-500 mt-1">
                      Material:{" "}
                      {selectedRequest.preferred_material}
                    </p>
                  )}
                  {selectedRequest.catalogue_design_name && (
                    <div className="mt-5 rounded-xl border border-[#e7dccd] bg-[#faf7f2] p-4">
                      <h3 className="font-semibold text-[#3d281c]">
                        Selected Furniture Design
                      </h3>

                      {selectedRequest.catalogue_design_image_url && (
                        <a
                          href={selectedRequest.catalogue_design_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={selectedRequest.catalogue_design_image_url}
                            alt={selectedRequest.catalogue_design_name}
                            className="mt-3 w-full max-h-[420px] object-contain rounded-lg border border-gray-200 bg-white"
                          />
                        </a>
                      )}

                      <p className="mt-3 font-medium text-[#3d281c]">
                        {selectedRequest.catalogue_design_name}
                      </p>

                      {selectedRequest.catalogue_design_id && (
                        <p className="mt-1 text-sm text-gray-500">
                          Design ID: {selectedRequest.catalogue_design_id}
                        </p>
                      )}
                    </div>
                  )}
                  {selectedRequest.reference_image_url && (
                    <div className="mt-4">
                      <img src={selectedRequest.reference_image_url} alt="Customer reference" className="w-full max-h-[420px] object-contain rounded-lg border border-gray-200 bg-white" />
                      <a href={selectedRequest.reference_image_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm font-medium text-[#7a5235] hover:underline">
                        Open Full Reference Image ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Quotation Number */}
                <div className="rounded-lg border border-[#e7dccd] p-4">
                  <p className="text-xs text-gray-500">
                    Quotation Number
                  </p>

                  <p className="text-lg font-semibold text-[#7a5235] mt-1">
                    {selectedQuotation.quotation_number}
                  </p>
                </div>

                {/* Amount */}
                <div>
                  <p className="text-sm text-gray-500">
                    Quotation Amount
                  </p>

                  <p className="text-2xl font-semibold text-[#3d281c] mt-1">
                    ₹
                    {Number(
                      selectedQuotation.amount
                    ).toLocaleString("en-IN")}
                  </p>
                </div>

                {/* Description */}
                <div>
                  <p className="text-sm text-gray-500">
                    Description
                  </p>

                  <div className="mt-1 rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedQuotation.description || "-"}
                  </div>
                </div>

                {/* Drawing */}
                <div className="rounded-lg border border-[#e7dccd] p-4">
                  <p className="text-sm font-medium text-gray-700">Drawing</p>

                  {selectedQuotation.drawing_url ? (
                    <div className="mt-3 space-y-2">
                      {selectedQuotation.drawing_name && (
                        <p className="text-sm text-gray-600">
                          {selectedQuotation.drawing_name}
                        </p>
                      )}
                      <a
                        href={selectedQuotation.drawing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg bg-[#5a3927] px-4 py-2 text-sm font-medium text-white hover:bg-[#432a1e]"
                      >
                        Open Drawing ↗
                      </a>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No drawing attached.</p>
                  )}
                </div>

                {/* Validity + Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-[#faf7f2] p-4">
                    <p className="text-xs text-gray-500">
                      Validity
                    </p>

                    <p className="font-medium text-gray-900 mt-1">
                      {selectedQuotation.validity_days} days
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#faf7f2] p-4">
                    <p className="text-xs text-gray-500">
                      Status
                    </p>

                    <span
                      className={`inline-flex mt-2 rounded-full px-3 py-1 text-xs font-medium ${getQuotationStatusClasses(
                        selectedQuotation.status
                      )}`}
                    >
                      {selectedQuotation.status}
                    </span>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <p className="text-sm text-gray-500">
                    Created On
                  </p>

                  <p className="text-sm text-gray-800 mt-1">
                    {new Date(
                      selectedQuotation.created_at
                    ).toLocaleString("en-IN")}
                  </p>
                </div>

                {quotationMessage && (
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      quotationMessage.type === "success"
                        ? "bg-green-50 border border-green-200 text-green-700"
                        : "bg-red-50 border border-red-200 text-red-700"
                    }`}
                  >
                    {quotationMessage.text}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={closeQuotation}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Create Quotation */
              <div className="px-6 py-6 space-y-5">

                {/* Customer */}
                <div className="rounded-lg bg-[#faf7f2] p-4">
                  <p className="text-xs text-gray-500">
                    Customer
                  </p>

                  <p className="font-medium text-gray-900 mt-1">
                    {selectedRequest.full_name}
                  </p>

                  <p className="text-sm text-gray-500">
                    {selectedRequest.furniture_type}
                  </p>

                  {selectedRequest.preferred_material && (
                    <p className="text-sm text-gray-500 mt-1">
                      Material:{" "}
                      {selectedRequest.preferred_material}
                    </p>
                  )}

                  {selectedRequest.reference_image_url && (
                    <a
                      href={selectedRequest.reference_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex text-sm font-medium text-[#7a5235] hover:underline"
                    >
                      View Customer Reference Image ↗
                    </a>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quotation Amount (₹)
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={quotationForm.amount}
                    onChange={(e) =>
                      setQuotationForm((current) => ({
                        ...current,
                        amount: e.target.value,
                      }))
                    }
                    placeholder="Enter total quotation amount"
                    disabled={quotationLoading}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235] disabled:bg-gray-100"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quotation Description
                  </label>

                  <textarea
                    rows={4}
                    value={quotationForm.description}
                    onChange={(e) =>
                      setQuotationForm((current) => ({
                        ...current,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Enter quotation details..."
                    disabled={quotationLoading}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none resize-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235] disabled:bg-gray-100"
                  />
                </div>

                {/* Validity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Validity (Days)
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={quotationForm.validity_days}
                    onChange={(e) =>
                      setQuotationForm((current) => ({
                        ...current,
                        validity_days: e.target.value,
                      }))
                    }
                    disabled={quotationLoading}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235] disabled:bg-gray-100"
                  />
                </div>

                {/* Drawing Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Drawing Name
                  </label>
                  <input
                    type="text"
                    value={quotationForm.drawing_name}
                    onChange={(e) =>
                      setQuotationForm((current) => ({
                        ...current,
                        drawing_name: e.target.value,
                      }))
                    }
                    placeholder="e.g. Custom Bed Drawing V1"
                    disabled={quotationLoading}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235] disabled:bg-gray-100"
                  />
                </div>

                {/* Drawing File */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Drawing File *</label>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setQuotationForm((current) => ({ ...current, drawing_file: e.target.files?.[0] || null }))} disabled={quotationLoading} className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235] disabled:bg-gray-100" />
                  <p className="mt-1 text-xs text-gray-500">JPG, PNG, WEBP or PDF. Maximum 15 MB.</p>
                  {quotationForm.drawing_file && <p className="mt-2 text-sm text-gray-600">Selected: {quotationForm.drawing_file.name}</p>}
                </div>

                {/* Message */}
                {quotationMessage && (
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      quotationMessage.type === "success"
                        ? "bg-green-50 border border-green-200 text-green-700"
                        : "bg-red-50 border border-red-200 text-red-700"
                    }`}
                  >
                    {quotationMessage.text}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={closeQuotation}
                    disabled={quotationLoading}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={createQuotation}
                    disabled={quotationLoading}
                    className="flex-1 rounded-lg bg-[#5a3927] text-white px-4 py-3 text-sm font-medium hover:bg-[#432a1e] disabled:opacity-50"
                  >
                    {quotationLoading
                      ? "Creating..."
                      : selectedQuotation
                      ? "Create New Quotation"
                      : "Create Quotation"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}