"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type OptionItem = {
  id: string;
  name: string;
};

type CatalogueProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: string;
  image_url: string;
  created_at?: string;
};

type AdminOrder = {
  id: string;
  order_number: string;
  user_id: string;
  request_id: string;
  quotation_id: string;
  amount: number;
  status: string;
  expected_delivery_date: string | null;
  delivery_address: string | null;
  created_at: string;
  updated_at: string;
  custom_requests?: {
    id: string;
    request_id?: string;
    full_name: string;
    mobile: string;
    email: string | null;
    furniture_type: string;
    room_usage: string | null;
    length?: string | null;
    width?: string | null;
    height?: string | null;
    preferred_material: string | null;
    requirement: string | null;
    delivery_location: string | null;
    reference_image_url: string | null;
    catalogue_design_name: string | null;
    catalogue_design_image_url: string | null;
  } | null;
  quotations?: {
    id: string;
    quotation_number: string;
    amount: number;
    description: string | null;
    validity_days: number;
    drawing_name: string | null;
    drawing_url: string | null;
  } | null;
};

const ORDER_STATUS_STAGES = [
  "Confirmed",
  "Production",
  "Quality Check",
  "Ready",
  "Out for Delivery",
  "Delivered",
] as const;

const ALL_ORDER_STATUSES = [
  "Confirmed",
  "Production",
  "Quality Check",
  "Ready",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
] as const;

function getOrderStatusBadgeClasses(status: string) {
  switch (status) {
    case "Confirmed":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Production":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Quality Check":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Ready":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Out for Delivery":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Delivered":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Cancelled":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function getOrderStatusDot(status: string) {
  switch (status) {
    case "Confirmed":
      return "bg-blue-500";
    case "Production":
      return "bg-purple-500 animate-pulse";
    case "Quality Check":
      return "bg-amber-500 animate-pulse";
    case "Ready":
      return "bg-indigo-500";
    case "Out for Delivery":
      return "bg-orange-500 animate-pulse";
    case "Delivered":
      return "bg-emerald-500";
    case "Cancelled":
      return "bg-rose-500";
    default:
      return "bg-gray-400";
  }
}

function formatOrderDate(dateString: string | null | undefined) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"requests" | "orders" | "options" | "products">("requests");

  const [ordersList, setOrdersList] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("All");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<AdminOrder | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [editingDeliveryDate, setEditingDeliveryDate] = useState<string>("");

  const [productsList, setProductsList] = useState<CatalogueProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [authVerified, setAuthVerified] = useState(false);
  const [toast, setToast] = useState<MessageState | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((feedback: MessageState | null, duration = 3000) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast(feedback);
    if (feedback) {
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, duration);
    }
  }, []);

  const setProductFeedback = (feedback: MessageState | null) => showToast(feedback, 3000);
  const setOptionsFeedback = (feedback: MessageState | null) => showToast(feedback, 3000);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const [editingProduct, setEditingProduct] = useState<CatalogueProduct | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    description: "",
    price: "",
    image_url: "",
    image_file: null as File | null,
  });

  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    description: "",
    price: "Custom Quote",
    image_url: "",
    image_file: null as File | null,
  });

  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [quotations, setQuotations] = useState<Record<string, Quotation>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [furnitureTypesList, setFurnitureTypesList] = useState<OptionItem[]>([]);
  const [materialsList, setMaterialsList] = useState<OptionItem[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [newMaterialName, setNewMaterialName] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemName: string;
    onConfirm: () => Promise<void> | void;
    loading?: boolean;
  } | null>(null);

  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteConfirm((prev) => (prev ? { ...prev, loading: true } : null));
    try {
      await deleteConfirm.onConfirm();
    } finally {
      setDeleteConfirm(null);
    }
  };

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
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session || !session.access_token || !session.user) {
        router.replace("/login");
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      setAuthVerified(true);

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

  const loadFurnitureOptions = useCallback(async () => {
    try {
      const [typesRes, matsRes] = await Promise.all([
        supabase.from("furniture_types").select("id, name").order("name"),
        supabase.from("material_preferences").select("id, name").order("name"),
      ]);

      if (typesRes.data) {
        setFurnitureTypesList(typesRes.data);
        if (typesRes.data.length > 0) {
          setProductForm((prev) => ({
            ...prev,
            category: prev.category || typesRes.data[0].name,
          }));
        }
      }
      if (matsRes.data) {
        setMaterialsList(matsRes.data);
      }
    } catch (err) {
      console.error("Error loading options:", err);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const { data, error: prodErr } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (prodErr) {
        console.error("Error loading products:", prodErr.message);
      } else if (data) {
        setProductsList(data);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const { data, error: ordersErr } = await supabase
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
          updated_at,
          custom_requests (
            id,
            request_id,
            full_name,
            mobile,
            email,
            furniture_type,
            room_usage,
            length,
            width,
            height,
            preferred_material,
            requirement,
            delivery_location,
            reference_image_url,
            catalogue_design_name,
            catalogue_design_image_url
          ),
          quotations (
            id,
            quotation_number,
            amount,
            description,
            validity_days,
            drawing_name,
            drawing_url
          )
        `)
        .order("created_at", { ascending: false });

      if (ordersErr) {
        console.error("Orders loading error:", ordersErr.message);
        return;
      }

      if (data) {
        const mappedOrders: AdminOrder[] = await Promise.all(
          (data as any[]).map(async (ord) => {
            const rawReq = Array.isArray(ord.custom_requests)
              ? ord.custom_requests[0]
              : ord.custom_requests;
            const rawQuote = Array.isArray(ord.quotations)
              ? ord.quotations[0]
              : ord.quotations;

            let refImg = rawReq?.reference_image_url || null;
            let drawUrl = rawQuote?.drawing_url || null;

            if (refImg) {
              refImg = await getStorageSignedUrl(refImg);
            }
            if (drawUrl) {
              drawUrl = await getStorageSignedUrl(drawUrl);
            }

            return {
              ...ord,
              custom_requests: rawReq
                ? { ...rawReq, reference_image_url: refImg }
                : null,
              quotations: rawQuote
                ? { ...rawQuote, drawing_url: drawUrl }
                : null,
            };
          })
        );
        setOrdersList(mappedOrders);
      }
    } catch (err) {
      console.error("Error in loadOrders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  async function handleUpdateOrderStatus(orderId: string, newStatus: string) {
    setUpdatingOrderId(orderId);
    try {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateErr) {
        showToast({
          type: "error",
          text: `Failed to update status: ${updateErr.message}`,
        });
        return;
      }

      setOrdersList((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
      );

      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails((prev) =>
          prev ? { ...prev, status: newStatus } : null
        );
      }

      showToast({
        type: "success",
        text: `Order status updated to "${newStatus}"! Customer can view this progress live in their account.`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        text: err?.message || "Failed to update order status.",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleUpdateDeliveryDate(orderId: string, newDate: string) {
    try {
      const isoDate = newDate ? new Date(newDate).toISOString() : null;
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          expected_delivery_date: isoDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateErr) {
        showToast({
          type: "error",
          text: `Failed to update delivery date: ${updateErr.message}`,
        });
        return;
      }

      setOrdersList((prev) =>
        prev.map((ord) =>
          ord.id === orderId ? { ...ord, expected_delivery_date: isoDate } : ord
        )
      );

      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails((prev) =>
          prev ? { ...prev, expected_delivery_date: isoDate } : null
        );
      }

      showToast({
        type: "success",
        text: "Expected delivery date updated successfully!",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        text: err?.message || "Failed to update delivery date.",
      });
    }
  }

  useEffect(() => {
    loadRequests();
    loadOrders();
    loadFurnitureOptions();
    loadProducts();
  }, [loadRequests, loadOrders, loadFurnitureOptions, loadProducts]);

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.category.trim()) {
      setProductFeedback({
        type: "error",
        text: "Please provide product name and select a category.",
      });
      return;
    }

    setProductsLoading(true);
    setProductFeedback(null);

    try {
      let finalImageUrl = productForm.image_url.trim();

      if (productForm.image_file) {
        const file = productForm.image_file;
        const fileExt = file.name.split(".").pop();
        const filePath = `products/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("gavika-project-files")
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          setProductFeedback({
            type: "error",
            text: `Image upload failed: ${uploadError.message}`,
          });
          setProductsLoading(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("gavika-project-files")
          .getPublicUrl(filePath);

        finalImageUrl = publicUrlData.publicUrl;
      }

      if (!finalImageUrl) {
        setProductFeedback({
          type: "error",
          text: "Please provide either an image file or an image URL.",
        });
        setProductsLoading(false);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("products")
        .insert({
          name: productForm.name.trim(),
          category: productForm.category,
          description: productForm.description.trim() || null,
          price: productForm.price.trim() || "Custom Quote",
          image_url: finalImageUrl,
        })
        .select()
        .single();

      if (insertError) {
        setProductFeedback({
          type: "error",
          text: insertError.message || "Failed to add product to database.",
        });
        return;
      }

      if (data) {
        setProductsList((prev) => [data, ...prev]);
        setProductForm({
          name: "",
          category: furnitureTypesList[0]?.name || "",
          description: "",
          price: "Custom Quote",
          image_url: "",
          image_file: null,
        });
        setProductFeedback({
          type: "success",
          text: `"${data.name}" added to catalogue successfully!`,
        });
      }
    } catch (err: any) {
      setProductFeedback({
        type: "error",
        text: err.message || "Unexpected error while saving product.",
      });
    } finally {
      setProductsLoading(false);
    }
  }

  function handleDeleteProduct(id: string, name: string) {
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Product Design",
      message: "Are you sure you want to permanently delete this design from your public catalogue? This action cannot be undone.",
      itemName: name,
      onConfirm: async () => {
        const { error: deleteError } = await supabase
          .from("products")
          .delete()
          .eq("id", id);

        if (deleteError) {
          setProductFeedback({
            type: "error",
            text: deleteError.message || "Failed to delete product.",
          });
          return;
        }

        setProductsList((prev) => prev.filter((p) => p.id !== id));
        setProductFeedback({
          type: "success",
          text: `Deleted "${name}" from catalogue.`,
        });
      },
    });
  }

  function openEditProduct(product: CatalogueProduct) {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      category: product.category,
      description: product.description || "",
      price: product.price,
      image_url: product.image_url,
      image_file: null,
    });
  }

  function closeEditProduct() {
    setEditingProduct(null);
    setEditForm({
      name: "",
      category: "",
      description: "",
      price: "",
      image_url: "",
      image_file: null,
    });
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editForm.name.trim()) return;

    setProductsLoading(true);
    setProductFeedback(null);

    try {
      let finalImageUrl = editForm.image_url.trim();

      if (editForm.image_file) {
        const file = editForm.image_file;
        const fileExt = file.name.split(".").pop();
        const filePath = `products/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("gavika-project-files")
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          setProductFeedback({
            type: "error",
            text: `Image upload failed: ${uploadError.message}`,
          });
          setProductsLoading(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("gavika-project-files")
          .getPublicUrl(filePath);

        finalImageUrl = publicUrlData.publicUrl;
      }

      if (!finalImageUrl) {
        setProductFeedback({
          type: "error",
          text: "Product must have an image.",
        });
        setProductsLoading(false);
        return;
      }

      const { data, error: updateError } = await supabase
        .from("products")
        .update({
          name: editForm.name.trim(),
          category: editForm.category.trim(),
          description: editForm.description.trim() || null,
          price: editForm.price.trim() || "Custom Quote",
          image_url: finalImageUrl,
        })
        .eq("id", editingProduct.id)
        .select()
        .single();

      if (updateError) {
        setProductFeedback({
          type: "error",
          text: updateError.message || "Failed to update product.",
        });
        return;
      }

      if (data) {
        setProductsList((prev) =>
          prev.map((p) => (p.id === data.id ? data : p))
        );
        closeEditProduct();
        setProductFeedback({
          type: "success",
          text: `"${data.name}" updated successfully!`,
        });
      }
    } catch (err: any) {
      setProductFeedback({
        type: "error",
        text: err.message || "Unexpected error updating product.",
      });
    } finally {
      setProductsLoading(false);
    }
  }

  async function handleAddFurnitureType(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = newTypeName.trim();
    if (!cleanName) return;

    setOptionsLoading(true);
    setOptionsFeedback(null);

    const { data, error: insertError } = await supabase
      .from("furniture_types")
      .insert({ name: cleanName })
      .select("id, name")
      .single();

    setOptionsLoading(false);

    if (insertError) {
      setOptionsFeedback({
        type: "error",
        text: insertError.message.includes("unique")
          ? `"${cleanName}" already exists in Furniture Types.`
          : insertError.message || "Failed to add furniture type.",
      });
      return;
    }

    if (data) {
      setFurnitureTypesList((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setProductForm((prev) => ({
        ...prev,
        category: prev.category || cleanName,
      }));
      setNewTypeName("");
      setOptionsFeedback({
        type: "success",
        text: `"${cleanName}" added to Furniture Types successfully!`,
      });
    }
  }

  function handleDeleteFurnitureType(id: string, name: string) {
    setDeleteConfirm({
      isOpen: true,
      title: "Remove Furniture Type",
      message: "Are you sure you want to remove this category from the master list? It will no longer appear in custom options or product categories.",
      itemName: name,
      onConfirm: async () => {
        const { error: deleteError } = await supabase
          .from("furniture_types")
          .delete()
          .eq("id", id);

        if (deleteError) {
          setOptionsFeedback({
            type: "error",
            text: deleteError.message || "Failed to delete item.",
          });
          return;
        }

        setFurnitureTypesList((prev) => prev.filter((item) => item.id !== id));
        setOptionsFeedback({
          type: "success",
          text: `Removed "${name}" from Furniture Types.`,
        });
      },
    });
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = newMaterialName.trim();
    if (!cleanName) return;

    setOptionsLoading(true);
    setOptionsFeedback(null);

    const { data, error: insertError } = await supabase
      .from("material_preferences")
      .insert({ name: cleanName })
      .select("id, name")
      .single();

    setOptionsLoading(false);

    if (insertError) {
      setOptionsFeedback({
        type: "error",
        text: insertError.message.includes("unique")
          ? `"${cleanName}" already exists in Material Preferences.`
          : insertError.message || "Failed to add material.",
      });
      return;
    }

    if (data) {
      setMaterialsList((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewMaterialName("");
      setOptionsFeedback({
        type: "success",
        text: `"${cleanName}" added to Material Preferences successfully!`,
      });
    }
  }

  function handleDeleteMaterial(id: string, name: string) {
    setDeleteConfirm({
      isOpen: true,
      title: "Remove Material Preference",
      message: "Are you sure you want to remove this material from the master list? It will no longer appear in customer selection.",
      itemName: name,
      onConfirm: async () => {
        const { error: deleteError } = await supabase
          .from("material_preferences")
          .delete()
          .eq("id", id);

        if (deleteError) {
          setOptionsFeedback({
            type: "error",
            text: deleteError.message || "Failed to delete item.",
          });
          return;
        }

        setMaterialsList((prev) => prev.filter((item) => item.id !== id));
        setOptionsFeedback({
          type: "success",
          text: `Removed "${name}" from Material Preferences.`,
        });
      },
    });
  }

  async function handleLogout() {
    try {
      const { error: logoutError } = await supabase.auth.signOut();

      if (logoutError) {
        setError("Unable to logout. Please try again.");
        return;
      }

      router.push("/login");
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

  if (!authVerified) {
    return (
      <main className="min-h-screen bg-[#f5efe6] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-3 border-[#3d281c] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-serif font-medium text-[#3d281c]">
          Verifying security token & admin access...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5efe6] relative">
      {/* Custom Confirmation Modal */}
      {deleteConfirm && deleteConfirm.isOpen && (
        <div
          onClick={() => !deleteConfirm.loading && setDeleteConfirm(null)}
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
              disabled={deleteConfirm.loading}
              onClick={() => setDeleteConfirm(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-[#f7f2ea] transition"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Trash / Warning Badge */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>

            {/* Title & Description */}
            <h3 className="text-xl font-serif font-semibold text-[#3d281c]">
              {deleteConfirm.title}
            </h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-sm mx-auto">
              {deleteConfirm.message}
            </p>

            {/* Action Buttons */}
            <div className="mt-6 grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={deleteConfirm.loading}
                onClick={() => setDeleteConfirm(null)}
                className="w-full py-3 px-4 rounded-xl border border-[#ded5c8] bg-white text-sm font-semibold text-gray-700 hover:bg-[#f7f2ea] hover:border-[#cfc4b4] transition active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirm.loading}
                onClick={handleExecuteDelete}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-sm font-semibold text-white shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {deleteConfirm.loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification (Floating top-right with 2.8s auto-dismiss & progress bar) */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] max-w-sm w-full transition-all duration-300 ease-out transform translate-y-0">
          <div
            className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-2xl backdrop-blur-sm ${
              toast.type === "success"
                ? "border-green-300 shadow-green-950/10"
                : "border-red-300 shadow-red-950/10"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  toast.type === "success"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {toast.type === "success" ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {toast.type === "success" ? "Success" : "Notice"}
                </p>
                <p className="text-sm font-medium text-gray-900 mt-0.5 leading-snug">
                  {toast.text}
                </p>
              </div>
              <button
                onClick={() => setToast(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Auto-dismiss progress bar animation */}
            <div
              className={`absolute bottom-0 left-0 h-1 ${
                toast.type === "success" ? "bg-green-500" : "bg-red-500"
              } w-full animate-toast-progress`}
            />
          </div>
        </div>
      )}

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

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-3 mb-8 border-b border-[#ded5c8] pb-4">
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition ${
              activeTab === "requests"
                ? "bg-[#3d281c] text-white shadow-sm"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-[#e7dccd]"
            }`}
          >
            📋 Customer Requests ({requests.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("orders");
              loadOrders();
            }}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
              activeTab === "orders"
                ? "bg-[#3d281c] text-white shadow-sm"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-[#e7dccd]"
            }`}
          >
            <span>📦 Customer Orders</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === "orders"
                  ? "bg-[#7a5235] text-white"
                  : "bg-[#f5efe6] text-[#7a5235]"
              }`}
            >
              {ordersList.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("products");
              loadProducts();
            }}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition ${
              activeTab === "products"
                ? "bg-[#3d281c] text-white shadow-sm"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-[#e7dccd]"
            }`}
          >
            🛋️ Catalogue Products ({productsList.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("options");
              loadFurnitureOptions();
            }}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition ${
              activeTab === "options"
                ? "bg-[#3d281c] text-white shadow-sm"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-[#e7dccd]"
            }`}
          >
            ⚙️ Master Options
          </button>
        </div>

        {activeTab === "products" ? (
          /* Products Manager */
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-serif font-semibold text-[#3d281c]">
                Catalogue Products & Designs
              </h2>
              <p className="text-gray-600 mt-1">
                Add and manage the furniture designs displayed in your public catalogue (`/furniture`).
              </p>
            </div>


            {/* Add New Product Form */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e7dccd]">
              <h3 className="text-xl font-serif font-semibold text-[#3d281c] mb-5">
                Add New Product Design
              </h3>

              <form onSubmit={handleAddProduct} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={productForm.name}
                      onChange={(e) =>
                        setProductForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g. Royal Chesterfield Sofa"
                      className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Category (Master) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTab("options")}
                        className="text-xs text-[#7a5235] hover:underline font-medium"
                      >
                        + Manage in Master
                      </button>
                    </div>
                    <select
                      required
                      value={productForm.category}
                      onChange={(e) =>
                        setProductForm((prev) => ({ ...prev, category: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                    >
                      <option value="" disabled>
                        Select a category...
                      </option>
                      {furnitureTypesList.length === 0 ? (
                        <option value="" disabled>
                          No categories found — add in Master tab
                        </option>
                      ) : (
                        furnitureTypesList.map((type) => (
                          <option key={type.id} value={type.name}>
                            {type.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Price
                    </label>
                    <input
                      type="text"
                      value={productForm.price}
                      onChange={(e) =>
                        setProductForm((prev) => ({ ...prev, price: e.target.value }))
                      }
                      placeholder="Custom Quote or ₹35,000"
                      className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Short Description
                  </label>
                  <textarea
                    rows={2}
                    value={productForm.description}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Short description of the furniture piece and its highlights..."
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                  />
                </div>

                {/* Image Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-[#faf7f2] border border-[#e7dccd]">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Image File
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          image_file: e.target.files?.[0] || null,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white text-gray-700 px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      JPG, PNG, WEBP. Uploads directly to Supabase storage.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Or Paste Image URL
                    </label>
                    <input
                      type="url"
                      value={productForm.image_url}
                      onChange={(e) =>
                        setProductForm((prev) => ({ ...prev, image_url: e.target.value }))
                      }
                      placeholder="https://images.unsplash.com/..."
                      className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Direct public image web link.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={productsLoading}
                    className="rounded-lg bg-[#5a3927] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#432a1e] transition disabled:opacity-50"
                  >
                    {productsLoading ? "Adding..." : "+ Add Product to Catalogue"}
                  </button>
                </div>
              </form>
            </div>

            {/* Products List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-serif font-semibold text-[#3d281c]">
                  Current Products ({productsList.length})
                </h3>
                <button
                  onClick={loadProducts}
                  className="rounded-lg border border-[#e7dccd] bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>

              {productsList.length === 0 ? (
                <div className="rounded-2xl bg-white border border-[#e7dccd] p-12 text-center text-gray-500">
                  <p className="text-base font-medium">No products in catalogue yet.</p>
                  <p className="text-xs mt-1 text-gray-400">
                    Use the form above to add your first furniture design.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {productsList.map((product) => (
                    <div
                      key={product.id}
                      className="rounded-2xl bg-white border border-[#e7dccd] overflow-hidden shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80";
                            }}
                          />
                          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#3d281c]">
                            {product.category}
                          </span>
                        </div>

                        <div className="p-5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-[#3d281c] text-lg">
                              {product.name}
                            </h4>
                            <span className="shrink-0 text-xs font-medium text-[#7a5235] bg-[#f5efe6] px-2.5 py-1 rounded-full">
                              {product.price}
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {product.description || "No description provided."}
                          </p>
                        </div>
                      </div>

                      <div className="p-5 pt-0 border-t border-gray-100 mt-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          ID: {product.id.slice(0, 8)}...
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditProduct(product)}
                            className="rounded-lg text-xs font-medium text-[#7a5235] hover:text-[#5a3927] hover:bg-[#f5efe6] px-3 py-1.5 transition border border-[#e7dccd]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product.id, product.name)}
                            className="rounded-lg text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "options" ? (
          /* Form Options Manager */
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-serif font-semibold text-[#3d281c]">
                Master Options Management
              </h2>
              <p className="text-gray-600 mt-1">
                Configure master Furniture Types / Categories (used across the product catalogue and custom furniture forms) and Material Preferences.
              </p>
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Furniture Types Management */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e7dccd] space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-serif font-semibold text-[#3d281c]">
                      Furniture Types / Product Categories
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Powers the category dropdown in Product Catalogue and custom request form.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f5efe6] text-[#7a5235] px-3 py-1 text-xs font-semibold">
                    {furnitureTypesList.length} Types
                  </span>
                </div>

                {/* Add New Type Form */}
                <form onSubmit={handleAddFurnitureType} className="flex gap-2">
                  <input
                    type="text"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="Add new type (e.g. Bookshelf)"
                    disabled={optionsLoading}
                    className="flex-1 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                  />
                  <button
                    type="submit"
                    disabled={optionsLoading || !newTypeName.trim()}
                    className="rounded-lg bg-[#5a3927] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#432a1e] transition disabled:opacity-50 shrink-0"
                  >
                    Add Type
                  </button>
                </form>

                {/* List */}
                <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                  {furnitureTypesList.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                      No custom furniture types found.
                    </p>
                  ) : (
                    furnitureTypesList.map((item) => (
                      <div
                        key={item.id}
                        className="py-3 flex items-center justify-between hover:bg-[#faf7f2] px-3 rounded-lg transition"
                      >
                        <span className="text-sm font-medium text-gray-800">
                          {item.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteFurnitureType(item.id, item.name)}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Material Preferences Management */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e7dccd] space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-serif font-semibold text-[#3d281c]">
                      Material Preferences
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Visible in the customer &ldquo;Material Preference&rdquo; dropdown.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#f5efe6] text-[#7a5235] px-3 py-1 text-xs font-semibold">
                    {materialsList.length} Materials
                  </span>
                </div>

                {/* Add New Material Form */}
                <form onSubmit={handleAddMaterial} className="flex gap-2">
                  <input
                    type="text"
                    value={newMaterialName}
                    onChange={(e) => setNewMaterialName(e.target.value)}
                    placeholder="Add new material (e.g. Teak Wood)"
                    disabled={optionsLoading}
                    className="flex-1 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                  />
                  <button
                    type="submit"
                    disabled={optionsLoading || !newMaterialName.trim()}
                    className="rounded-lg bg-[#5a3927] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#432a1e] transition disabled:opacity-50 shrink-0"
                  >
                    Add Material
                  </button>
                </form>

                {/* List */}
                <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                  {materialsList.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                      No materials found.
                    </p>
                  ) : (
                    materialsList.map((item) => (
                      <div
                        key={item.id}
                        className="py-3 flex items-center justify-between hover:bg-[#faf7f2] px-3 rounded-lg transition"
                      >
                        <span className="text-sm font-medium text-gray-800">
                          {item.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaterial(item.id, item.name)}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "orders" ? (
          /* Customer Orders Tab Content */
          <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-serif font-semibold text-[#3d281c]">
                  Customer Orders & Fulfillment Tracking
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  Track live orders placed when customers approve quotations. Update production stages (visible in real-time on customer account), manage target delivery dates, and review CAD drawings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadOrders()}
                disabled={ordersLoading}
                className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#ded5c8] bg-white text-sm font-semibold text-gray-700 hover:bg-[#faf7f2] hover:border-[#cfc4b4] transition disabled:opacity-50 shadow-xs"
              >
                <svg
                  className={`w-4 h-4 text-[#7a5235] ${ordersLoading ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{ordersLoading ? "Refreshing..." : "Refresh Orders"}</span>
              </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-[#e7dccd] shadow-xs">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</p>
                <p className="text-2xl font-serif font-bold text-[#3d281c] mt-2">{ordersList.length}</p>
                <p className="text-xs text-gray-500 mt-1">Confirmed & Active</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#e7dccd] shadow-xs">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value</p>
                <p className="text-2xl font-serif font-bold text-[#7a5235] mt-2">
                  ₹{ordersList.filter(o => o.status !== "Cancelled").reduce((sum, o) => sum + (Number(o.amount) || 0), 0).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-gray-500 mt-1">Confirmed revenue</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#e7dccd] shadow-xs">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">In Production / QA</p>
                <p className="text-2xl font-serif font-bold text-amber-900 mt-2">
                  {ordersList.filter(o => o.status === "Production" || o.status === "Quality Check").length}
                </p>
                <p className="text-xs text-amber-600 mt-1">Workshop active</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#e7dccd] shadow-xs">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Ready / Dispatched</p>
                <p className="text-2xl font-serif font-bold text-indigo-900 mt-2">
                  {ordersList.filter(o => o.status === "Ready" || o.status === "Out for Delivery").length}
                </p>
                <p className="text-xs text-indigo-600 mt-1">Transit / Dispatch</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-[#e7dccd] shadow-xs col-span-2 lg:col-span-1">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Delivered</p>
                <p className="text-2xl font-serif font-bold text-emerald-900 mt-2">
                  {ordersList.filter(o => o.status === "Delivered").length}
                </p>
                <p className="text-xs text-emerald-600 mt-1">Completed orders</p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white rounded-2xl p-4 border border-[#e7dccd] shadow-xs space-y-4">
              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "All", label: "All Orders", count: ordersList.length },
                  { key: "Confirmed", label: "Confirmed", count: ordersList.filter(o => o.status === "Confirmed").length },
                  { key: "Production", label: "In Production", count: ordersList.filter(o => o.status === "Production").length },
                  { key: "Quality Check", label: "Quality Check", count: ordersList.filter(o => o.status === "Quality Check").length },
                  { key: "Ready", label: "Ready", count: ordersList.filter(o => o.status === "Ready").length },
                  { key: "Out for Delivery", label: "Out for Delivery", count: ordersList.filter(o => o.status === "Out for Delivery").length },
                  { key: "Delivered", label: "Delivered", count: ordersList.filter(o => o.status === "Delivered").length },
                  { key: "Cancelled", label: "Cancelled", count: ordersList.filter(o => o.status === "Cancelled").length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setOrderStatusFilter(tab.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                      orderStatusFilter === tab.key
                        ? "bg-[#3d281c] text-white shadow-xs"
                        : "bg-[#f5efe6] text-gray-700 hover:bg-[#ede3d5]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        orderStatusFilter === tab.key
                          ? "bg-white/20 text-white"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search orders by Order #, Customer Name, Mobile, Email, or Furniture Type..."
                  className="w-full rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                />
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {orderSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setOrderSearchQuery("")}
                    className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#e7dccd] overflow-hidden">
              {ordersLoading ? (
                <div className="p-12 text-center text-gray-500 space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7a5235] mx-auto"></div>
                  <p className="text-sm">Loading customer orders...</p>
                </div>
              ) : (() => {
                const filtered = ordersList.filter((ord) => {
                  const matchesFilter =
                    orderStatusFilter === "All" || ord.status === orderStatusFilter;
                  if (!matchesFilter) return false;

                  if (!orderSearchQuery.trim()) return true;
                  const q = orderSearchQuery.toLowerCase();
                  const orderNum = (ord.order_number || "").toLowerCase();
                  const custName = (ord.custom_requests?.full_name || "").toLowerCase();
                  const custPhone = (ord.custom_requests?.mobile || "").toLowerCase();
                  const custEmail = (ord.custom_requests?.email || "").toLowerCase();
                  const furnType = (ord.custom_requests?.furniture_type || "").toLowerCase();
                  const quoteNum = (ord.quotations?.quotation_number || "").toLowerCase();

                  return (
                    orderNum.includes(q) ||
                    custName.includes(q) ||
                    custPhone.includes(q) ||
                    custEmail.includes(q) ||
                    furnType.includes(q) ||
                    quoteNum.includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-12 text-center space-y-3">
                      <div className="w-14 h-14 mx-auto rounded-full bg-[#f5efe6] flex items-center justify-center text-2xl">
                        📦
                      </div>
                      <h4 className="text-lg font-serif font-semibold text-[#3d281c]">
                        No Customer Orders Found
                      </h4>
                      <p className="text-sm text-gray-500 max-w-md mx-auto">
                        {orderSearchQuery || orderStatusFilter !== "All"
                          ? "No orders match the current filter or search criteria."
                          : "Orders are created automatically when a customer approves a quotation from their account portal."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#f5efe6] text-[#3d281c] font-semibold text-xs border-b border-[#ded5c8]">
                        <tr>
                          <th className="text-left px-5 py-4">Order # & Date</th>
                          <th className="text-left px-5 py-4">Customer</th>
                          <th className="text-left px-5 py-4">Item & Drawing</th>
                          <th className="text-left px-5 py-4">Delivery & Target</th>
                          <th className="text-left px-5 py-4">Amount</th>
                          <th className="text-left px-5 py-4">Live Status & Update</th>
                          <th className="text-left px-5 py-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filtered.map((ord) => {
                          const req = ord.custom_requests;
                          const quote = ord.quotations;

                          return (
                            <tr
                              key={ord.id}
                              className="hover:bg-[#faf7f2] transition-colors"
                            >
                              {/* Order Number & Date */}
                              <td className="px-5 py-4">
                                <span className="font-semibold text-[#7a5235] block font-mono">
                                  {ord.order_number}
                                </span>
                                <span className="text-xs text-gray-500 block mt-0.5">
                                  {formatOrderDate(ord.created_at)}
                                </span>
                                {quote?.quotation_number && (
                                  <span className="text-[10px] text-gray-400 block font-mono">
                                    Quote: {quote.quotation_number}
                                  </span>
                                )}
                              </td>

                              {/* Customer */}
                              <td className="px-5 py-4">
                                <div className="font-medium text-gray-900">
                                  {req?.full_name || "Customer"}
                                </div>
                                {req?.mobile && (
                                  <a
                                    href={`tel:${req.mobile}`}
                                    className="text-xs text-[#7a5235] hover:underline flex items-center gap-1 mt-0.5"
                                  >
                                    <span>📞</span>
                                    <span>{req.mobile}</span>
                                  </a>
                                )}
                                {req?.email && (
                                  <a
                                    href={`mailto:${req.email}`}
                                    className="text-[11px] text-gray-500 hover:underline block truncate max-w-[180px]"
                                    title={req.email}
                                  >
                                    {req.email}
                                  </a>
                                )}
                              </td>

                              {/* Item & Specs */}
                              <td className="px-5 py-4">
                                <div className="font-medium text-gray-800">
                                  {req?.furniture_type || "Custom Furniture"}
                                </div>
                                {req?.catalogue_design_name && (
                                  <span className="text-xs text-[#7a5235] block">
                                    {req.catalogue_design_name}
                                  </span>
                                )}
                                {quote?.drawing_url ? (
                                  <a
                                    href={quote.drawing_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-[#7a5235] hover:underline font-semibold mt-1 bg-[#f5efe6] px-2 py-0.5 rounded"
                                  >
                                    <span>📐</span>
                                    <span>CAD Drawing</span>
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-gray-400 block mt-0.5">
                                    No CAD attached
                                  </span>
                                )}
                              </td>

                              {/* Delivery */}
                              <td className="px-5 py-4">
                                <div className="text-xs text-gray-800 max-w-[200px] truncate" title={ord.delivery_address || req?.delivery_location || ""}>
                                  📍 {ord.delivery_address || req?.delivery_location || "Not specified"}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <span>📅 Target:</span>
                                  <span className="font-medium text-gray-700">
                                    {formatOrderDate(ord.expected_delivery_date)}
                                  </span>
                                </div>
                              </td>

                              {/* Amount */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <span className="font-serif font-bold text-[#3d281c] text-base">
                                  ₹{Number(ord.amount).toLocaleString("en-IN")}
                                </span>
                              </td>

                              {/* Live Status & Quick Selector */}
                              <td className="px-5 py-4">
                                <div className="space-y-1.5">
                                  <div>
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getOrderStatusBadgeClasses(
                                        ord.status
                                      )}`}
                                    >
                                      <span
                                        className={`h-2 w-2 rounded-full ${getOrderStatusDot(
                                          ord.status
                                        )}`}
                                      />
                                      <span>{ord.status}</span>
                                    </span>
                                  </div>

                                  {/* Quick Stage Dropdown */}
                                  <select
                                    value={ord.status}
                                    disabled={updatingOrderId === ord.id}
                                    onChange={(e) =>
                                      handleUpdateOrderStatus(ord.id, e.target.value)
                                    }
                                    className="text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-800 px-2.5 py-1 focus:border-[#7a5235] outline-none shadow-xs cursor-pointer hover:border-[#7a5235] transition disabled:opacity-50"
                                  >
                                    <option value="" disabled>Change stage...</option>
                                    {ALL_ORDER_STATUSES.map((st) => (
                                      <option key={st} value={st}>
                                        → {st}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>

                              {/* Action */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrderDetails(ord);
                                    setEditingDeliveryDate(
                                      ord.expected_delivery_date
                                        ? ord.expected_delivery_date.split("T")[0]
                                        : ""
                                    );
                                  }}
                                  className="rounded-lg bg-[#3d281c] text-white px-3.5 py-2 text-xs font-medium hover:bg-[#5a3927] transition flex items-center gap-1.5 shadow-xs"
                                >
                                  <span>🔍</span>
                                  <span>Track & Details</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          /* Customer Requests Tab Content */
          <>
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
                          <div className="flex flex-col gap-1.5 items-start">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                                request.status
                              )}`}
                            >
                              {request.status}
                            </span>
                            {(() => {
                              const relatedOrder = ordersList.find(
                                (o) => o.request_id === request.id
                              );
                              if (!relatedOrder) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab("orders");
                                    setSelectedOrderDetails(relatedOrder);
                                    setEditingDeliveryDate(
                                      relatedOrder.expected_delivery_date
                                        ? relatedOrder.expected_delivery_date.split("T")[0]
                                        : ""
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full transition shadow-2xs"
                                  title="View order tracking in Orders tab"
                                >
                                  📦 Order: {relatedOrder.status} →
                                </button>
                              );
                            })()}
                          </div>
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
        </>
        )}
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

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-serif font-semibold text-[#3d281c]">
                  Edit Product
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ID: {editingProduct.id}
                </p>
              </div>
              <button
                onClick={closeEditProduct}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleUpdateProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Category (Master) *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setActiveTab("options");
                      }}
                      className="text-xs text-[#7a5235] hover:underline font-medium"
                    >
                      + Manage in Master
                    </button>
                  </div>
                  <select
                    required
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                  >
                    <option value="" disabled>
                      Select a category...
                    </option>
                    {/* Preserve existing category if not present in the master list */}
                    {editForm.category &&
                      !furnitureTypesList.some((t) => t.name === editForm.category) && (
                        <option value={editForm.category}>
                          {editForm.category} (Current)
                        </option>
                      )}
                    {furnitureTypesList.map((type) => (
                      <option key={type.id} value={type.name}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Price
                  </label>
                  <input
                    type="text"
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, price: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm outline-none focus:border-[#7a5235]"
                />
              </div>

              {/* Current Image & Update Option */}
              <div className="p-4 rounded-xl bg-[#faf7f2] border border-[#e7dccd] space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a5235]">
                  Product Image
                </label>

                {editForm.image_url && (
                  <div className="flex items-center gap-3">
                    <img
                      src={editForm.image_url}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                    />
                    <span className="text-xs text-gray-500 break-all">
                      Current image preview
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Upload New Image File (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        image_file: e.target.files?.[0] || null,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-700 px-3 py-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Or Edit Image URL
                  </label>
                  <input
                    type="url"
                    value={editForm.image_url}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, image_url: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2 text-xs outline-none focus:border-[#7a5235]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditProduct}
                  disabled={productsLoading}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={productsLoading}
                  className="flex-1 rounded-lg bg-[#5a3927] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#432a1e] transition disabled:opacity-50"
                >
                  {productsLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comprehensive Order Details & Live Tracking Modal */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-[#ded5c8] overflow-hidden my-auto max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="border-b border-[#ded5c8] bg-[#fbf9f6] px-6 py-5 flex items-start justify-between gap-4 shrink-0">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-bold text-[#7a5235]">
                    {selectedOrderDetails.order_number}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border ${getOrderStatusBadgeClasses(
                      selectedOrderDetails.status
                    )}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${getOrderStatusDot(
                        selectedOrderDetails.status
                      )}`}
                    />
                    <span>{selectedOrderDetails.status}</span>
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Placed on {formatOrderDate(selectedOrderDetails.created_at)} • Total Order Value: ₹{Number(selectedOrderDetails.amount).toLocaleString("en-IN")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Live Customer Portal Stepper */}
              <div className="bg-[#faf7f2] rounded-2xl p-5 border border-[#e7dccd]">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-serif font-bold text-[#3d281c] flex items-center gap-2">
                    <span>📡</span>
                    <span>Live Customer Portal Tracker Status</span>
                  </h4>
                  <span className="text-xs text-gray-500">
                    Step {ORDER_STATUS_STAGES.indexOf(selectedOrderDetails.status as any) + 1} of 6
                  </span>
                </div>

                {/* Progress Bar & Milestones */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {ORDER_STATUS_STAGES.map((stage, idx) => {
                    const currentIndex = ORDER_STATUS_STAGES.indexOf(
                      selectedOrderDetails.status as any
                    );
                    const isPassed = currentIndex >= idx;
                    const isCurrent = selectedOrderDetails.status === stage;

                    return (
                      <div
                        key={stage}
                        className={`rounded-xl p-2.5 text-center transition border ${
                          isCurrent
                            ? "bg-[#3d281c] text-white border-[#3d281c] shadow-sm font-semibold"
                            : isPassed
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-white text-gray-400 border-gray-200"
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5">
                          {isCurrent ? "★ CURRENT" : isPassed ? "✓ DONE" : `STEP ${idx + 1}`}
                        </div>
                        <div className="text-xs truncate font-medium">
                          {stage}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Advance / Change Stage Buttons */}
                <div className="mt-4 pt-4 border-t border-[#ded5c8]">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Click to Update Customer Tracking Stage (Changes reflect immediately on customer portal):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ORDER_STATUSES.map((stage) => {
                      const isCurrent = selectedOrderDetails.status === stage;
                      return (
                        <button
                          key={stage}
                          type="button"
                          disabled={updatingOrderId === selectedOrderDetails.id}
                          onClick={() =>
                            handleUpdateOrderStatus(selectedOrderDetails.id, stage)
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                            isCurrent
                              ? "bg-[#7a5235] text-white font-semibold ring-2 ring-[#7a5235]/40"
                              : "bg-white border border-[#ded5c8] text-gray-700 hover:bg-[#f5efe6]"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${getOrderStatusDot(
                              stage
                            )}`}
                          />
                          <span>{stage}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Target Delivery Date Section */}
              <div className="bg-white rounded-2xl p-5 border border-[#e7dccd] shadow-xs">
                <h4 className="text-sm font-serif font-bold text-[#3d281c] mb-3 flex items-center gap-2">
                  <span>📅</span>
                  <span>Target Delivery Date & Address</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Expected Delivery Date
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={editingDeliveryDate}
                        onChange={(e) => setEditingDeliveryDate(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-xs outline-none focus:border-[#7a5235] flex-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateDeliveryDate(
                            selectedOrderDetails.id,
                            editingDeliveryDate
                          )
                        }
                        className="rounded-lg bg-[#5a3927] hover:bg-[#432a1e] text-white text-xs font-semibold px-4 py-2 transition shadow-xs"
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Delivery Address / Destination
                    </label>
                    <p className="text-sm text-gray-800 bg-[#faf7f2] p-2.5 rounded-lg border border-[#e7dccd]">
                      📍 {selectedOrderDetails.delivery_address || selectedOrderDetails.custom_requests?.delivery_location || "Not specified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Contact & Item Specifications */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Details */}
                <div className="bg-white rounded-2xl p-5 border border-[#e7dccd] shadow-xs space-y-3">
                  <h4 className="text-sm font-serif font-bold text-[#3d281c] flex items-center gap-2">
                    <span>👤</span>
                    <span>Customer Details</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-gray-500 block">Name</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {selectedOrderDetails.custom_requests?.full_name || "Customer"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Phone</span>
                      {selectedOrderDetails.custom_requests?.mobile ? (
                        <a
                          href={`tel:${selectedOrderDetails.custom_requests.mobile}`}
                          className="text-sm font-medium text-[#7a5235] hover:underline flex items-center gap-1"
                        >
                          📞 {selectedOrderDetails.custom_requests.mobile}
                        </a>
                      ) : (
                        "-"
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500 block">Email</span>
                      {selectedOrderDetails.custom_requests?.email ? (
                        <a
                          href={`mailto:${selectedOrderDetails.custom_requests.email}`}
                          className="text-xs font-medium text-gray-700 hover:underline"
                        >
                          ✉️ {selectedOrderDetails.custom_requests.email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </div>
                  </div>
                </div>

                {/* Quotation & CAD Specs */}
                <div className="bg-white rounded-2xl p-5 border border-[#e7dccd] shadow-xs space-y-3">
                  <h4 className="text-sm font-serif font-bold text-[#3d281c] flex items-center gap-2">
                    <span>📐</span>
                    <span>Quotation & CAD Design</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-gray-500 block">Quotation Number</span>
                      <span className="font-mono font-semibold text-gray-800">
                        {selectedOrderDetails.quotations?.quotation_number || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Approved Amount</span>
                      <span className="font-serif font-bold text-base text-[#3d281c]">
                        ₹{Number(selectedOrderDetails.amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">CAD / 3D Drawing</span>
                      {selectedOrderDetails.quotations?.drawing_url ? (
                        <a
                          href={selectedOrderDetails.quotations.drawing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7a5235] bg-[#f5efe6] px-3 py-1.5 rounded-lg hover:bg-[#ebdcc8] transition mt-1"
                        >
                          <span>📐 View / Download CAD Drawing ({selectedOrderDetails.quotations.drawing_name || "File"})</span>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-gray-400">No drawing uploaded</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Furniture Specs */}
              {selectedOrderDetails.custom_requests && (
                <div className="bg-white rounded-2xl p-5 border border-[#e7dccd] shadow-xs space-y-3">
                  <h4 className="text-sm font-serif font-bold text-[#3d281c] flex items-center gap-2">
                    <span>🛋️</span>
                    <span>Furniture Specifications</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 block">Furniture Type</span>
                      <span className="font-semibold text-gray-800">
                        {selectedOrderDetails.custom_requests.furniture_type}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Room Usage</span>
                      <span className="font-semibold text-gray-800">
                        {selectedOrderDetails.custom_requests.room_usage || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Dimensions (L × W × H)</span>
                      <span className="font-semibold text-gray-800">
                        {[
                          selectedOrderDetails.custom_requests.length,
                          selectedOrderDetails.custom_requests.width,
                          selectedOrderDetails.custom_requests.height,
                        ]
                          .filter(Boolean)
                          .join(" × ") || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Material</span>
                      <span className="font-semibold text-gray-800">
                        {selectedOrderDetails.custom_requests.preferred_material || "-"}
                      </span>
                    </div>
                  </div>

                  {selectedOrderDetails.custom_requests.requirement && (
                    <div className="pt-2 text-xs">
                      <span className="text-gray-500 block mb-1">Customer Requirements / Notes</span>
                      <p className="bg-[#faf7f2] p-3 rounded-lg border border-[#e7dccd] text-gray-700 whitespace-pre-wrap">
                        {selectedOrderDetails.custom_requests.requirement}
                      </p>
                    </div>
                  )}

                  {selectedOrderDetails.custom_requests.reference_image_url && (
                    <div className="pt-2">
                      <span className="text-xs text-gray-500 block mb-1">Reference Image</span>
                      <a
                        href={selectedOrderDetails.custom_requests.reference_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <img
                          src={selectedOrderDetails.custom_requests.reference_image_url}
                          alt="Customer reference"
                          className="h-28 w-28 object-cover rounded-xl border border-gray-200 hover:opacity-90 transition"
                        />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#ded5c8] bg-[#fbf9f6] px-6 py-4 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}