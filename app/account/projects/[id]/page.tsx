"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";

interface CustomProject {
  id: string;
  request_id: string;
  furniture_type: string | null;
  room_usage: string | null;
  preferred_material: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  requirement: string | null;
  delivery_location: string | null;
  status: string | null;
  created_at: string;
  reference_image_url: string | null;

  catalogue_design_id: string | null;
  catalogue_design_name: string | null;
  catalogue_design_image_url: string | null;
}

interface Quotation {
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
}

type ProgressStep = {
  key: string;
  title: string;
  icon: string;
  description: string;
};

const progressSteps: ProgressStep[] = [
  {
    key: "request",
    title: "Request",
    icon: "📝",
    description: "Your custom furniture request has been submitted.",
  },
  {
    key: "quotation",
    title: "Quotation",
    icon: "💰",
    description: "Quotation is being prepared or has been shared.",
  },
  {
    key: "production",
    title: "Production",
    icon: "🏭",
    description: "Your furniture is being prepared.",
  },
  {
    key: "qc",
    title: "Quality Check",
    icon: "🔍",
    description: "Final quality checking is in progress.",
  },
  {
    key: "ready",
    title: "Ready",
    icon: "📦",
    description: "Your furniture is ready for delivery.",
  },
  {
    key: "delivery",
    title: "Delivery",
    icon: "🚚",
    description: "Your furniture is being delivered.",
  },
];

function getStatusStep(status: string | null): number {
  switch (status) {
    case "New":
      return 0;

    case "Quotation Sent":
      return 1;

    case "Approved":
      return 2;

    case "In Progress":
      return 2;

    case "QC":
    case "Quality Check":
      return 3;

    case "Ready":
      return 4;

    case "Out for Delivery":
    case "Delivery":
      return 5;

    case "Delivered":
      return 6;

    case "Rejected":
      return 1;

    default:
      return 0;
  }
}

function getStatusClasses(status: string | null) {
  switch (status) {
    case "New":
      return "bg-blue-100 text-blue-800";

    case "Quotation Sent":
      return "bg-purple-100 text-purple-800";

    case "Approved":
      return "bg-green-100 text-green-800";

    case "In Progress":
      return "bg-orange-100 text-orange-800";

    case "QC":
    case "Quality Check":
      return "bg-indigo-100 text-indigo-800";

    case "Ready":
      return "bg-emerald-100 text-emerald-800";

    case "Out for Delivery":
    case "Delivery":
      return "bg-cyan-100 text-cyan-800";

    case "Delivered":
      return "bg-green-100 text-green-800";

    case "Rejected":
      return "bg-red-100 text-red-800";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [project, setProject] = useState<CustomProject | null>(null);
  const [quotation, setQuotation] = useState<Quotation | null>(null);

  const [loading, setLoading] = useState(true);
  const [quotationLoading, setQuotationLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleQuotationDecision = useCallback(
    async (decision: "Approved" | "Rejected") => {
      if (!quotation || actionLoading) return;

      const confirmed = window.confirm(
        decision === "Approved"
          ? "Please confirm that you have reviewed the quotation and drawing and want to approve it."
          : "Please confirm that you want to reject this quotation."
      );

      if (!confirmed) return;

      setActionLoading(true);
      setError("");

      try {
        const { data: { user }, error: authError } =
          await supabase.auth.getUser();

        if (authError || !user) {
          setError("Unable to verify your account.");
          return;
        }

        const { error: quotationUpdateError } = await supabase
          .from("quotations")
          .update({ status: decision, updated_at: new Date().toISOString() })
          .eq("id", quotation.id)
          .eq("request_id", projectId);

        if (quotationUpdateError) {
          console.error("Quotation decision error:", quotationUpdateError);
          setError("Unable to update the quotation. Please try again.");
          return;
        }

        const projectStatus =
          decision === "Approved" ? "Approved" : "Quotation Rejected";

        const { error: projectUpdateError } = await supabase
          .from("custom_requests")
          .update({ status: projectStatus })
          .eq("id", projectId)
          .eq("user_id", user.id);

        if (projectUpdateError) {
          console.error("Project status update error:", projectUpdateError);
          setError("Quotation updated, but project status could not be updated.");
          return;
        }

        setQuotation((previous) =>
          previous ? { ...previous, status: decision } : previous
        );
        setProject((previous) =>
          previous ? { ...previous, status: projectStatus } : previous
        );
      } catch (err) {
        console.error("Quotation decision error:", err);
        setError("Something went wrong. Please try again.");
      } finally {
        setActionLoading(false);
      }
    },
    [quotation, actionLoading, projectId]
  );

  const loadProject = useCallback(async () => {
    setLoading(true);
    setQuotationLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("Auth error:", authError);
        setError("Unable to verify your account.");
        setLoading(false);
        setQuotationLoading(false);
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      /*
        Load only the project belonging to
        the currently logged-in customer.
      */
      const { data, error: projectError } = await supabase
        .from("custom_requests")
        .select(`
          id,
          request_id,
          furniture_type,
          room_usage,
          preferred_material,
          length,
          width,
          height,
          requirement,
          delivery_location,
          status,
          created_at,
          reference_image_url,
          catalogue_design_id,
          catalogue_design_name,
          catalogue_design_image_url
        `)
        .eq("id", projectId)
        .eq("user_id", user.id) 
        .single();

      if (projectError) {
        console.error("Project loading error:", projectError);

        setError(
          "Project not found or you do not have permission to view it."
        );

        setProject(null);
        setQuotation(null);
        setLoading(false);
        setQuotationLoading(false);
        return;
      }

      const currentProject = data as CustomProject;

      if (currentProject.reference_image_url && !currentProject.reference_image_url.startsWith("http")) {
        const { data: signed, error: signedError } = await supabase.storage.from("gavika-project-files").createSignedUrl(currentProject.reference_image_url, 60 * 60);
        if (signedError) console.error("Reference image URL error:", signedError);
        if (signed?.signedUrl) currentProject.reference_image_url = signed.signedUrl;
      }

      setProject(currentProject);
      setLoading(false);

      /*
        Load quotation belonging to this request.
        If there is no quotation yet, that is not an error.
      */
      const { data: quotationData, error: quotationError } =
        await supabase
          .from("quotations")
          .select(
            `
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
          `
          )
          .eq("request_id", currentProject.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (quotationError) {
        console.error(
          "Quotation loading error:",
          quotationError
        );

        /*
          Don't break the complete project page
          if quotation cannot be loaded.
        */
        setQuotation(null);
      } else {
        const currentQuotation = quotationData
          ? (quotationData as Quotation)
          : null;
        if (currentQuotation?.drawing_url) {
          const drawingPath = currentQuotation.drawing_url;

          const isDirectUrl =
            drawingPath.startsWith("http://") ||
            drawingPath.startsWith("https://");

          if (!isDirectUrl) {
            const { data: signedDrawing, error: drawingError } =
              await supabase.storage
                .from("gavika-project-files")
                .createSignedUrl(
                  drawingPath,
                  60 * 60
                );

            if (drawingError) {
              console.error(
                "Customer drawing URL error:",
                drawingError
              );
            }

            if (signedDrawing?.signedUrl) {
              currentQuotation.drawing_url =
                signedDrawing.signedUrl;
            }
          }
        }

        if (currentQuotation?.drawing_url) {
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
                "Drawing URL error:",
                signedError
              );
            }

            if (signed?.signedUrl) {
              currentQuotation.drawing_url = signed.signedUrl;
            }
          }
        }

        
        setQuotation(currentQuotation);
      }

      setQuotationLoading(false);
    } catch (err) {
      console.error("Unexpected project error:", err);

      setError("Something went wrong. Please try again.");

      setProject(null);
      setQuotation(null);

      setLoading(false);
      setQuotationLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5efe6] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 text-[#5a3927]">
            <span className="h-6 w-6 border-3 border-[#5a3927]/30 border-t-[#5a3927] rounded-full animate-spin" />

            <span className="text-lg">
              Loading project...
            </span>
          </div>

          <p className="text-sm text-gray-500">
            Please wait a moment
          </p>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="min-h-screen bg-[#f5efe6]">
        <header className="bg-[#3d281c] text-white shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <Link
              href="/account"
              className="text-2xl font-serif font-semibold hover:opacity-90 transition"
            >
              Gavika Furnitech
            </Link>
          </div>
        </header>

        <section className="max-w-3xl mx-auto px-6 py-16">
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>

            <h1 className="text-2xl font-serif font-semibold text-[#3d281c]">
              Project Not Found
            </h1>

            <p className="text-gray-600 mt-3">
              {error || "This project could not be found."}
            </p>

            <Link
              href="/account"
              className="inline-block mt-6 rounded-lg bg-[#5a3927] text-white px-6 py-3 font-medium hover:bg-[#432a1e] transition"
            >
              ← Back to My Account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const dimensions =
    project.length ||
    project.width ||
    project.height
      ? `${project.length || "-"} × ${
          project.width || "-"
        } × ${project.height || "-"}`
      : "Not specified";

  const submittedDate = new Date(
    project.created_at
  ).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const currentStep = getStatusStep(project.status);

  const isRejected =
    project.status === "Rejected";

  return (
    <main className="min-h-screen bg-[#f5efe6]">
      {/* Header */}
      <header className="bg-[#3d281c] text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-serif font-semibold hover:opacity-90 transition"
          >
            Gavika Furnitech
          </Link>

          <Link
            href="/account"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition"
          >
            My Account
          </Link>
        </div>
      </header>

      {/* Main */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        {/* Back */}
        <Link
          href="/account"
          className="inline-flex items-center text-sm font-medium text-[#7a5235] hover:underline mb-6"
        >
          ← Back to My Projects
        </Link>

        {/* Project Header */}
        <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
            <div>
              <p className="text-sm text-gray-500">
                Custom Project
              </p>

              <h1 className="text-3xl font-serif font-semibold text-[#3d281c] mt-2">
                {project.furniture_type ||
                  "Custom Furniture"}
              </h1>

              <p className="text-sm text-gray-500 mt-3">
                Request ID:{" "}
                <span className="font-semibold text-[#5a3927]">
                  {project.request_id}
                </span>
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusClasses(
                  project.status
                )}`}
              >
                {project.status || "New"}
              </span>

              <p className="text-xs text-gray-500">
                Submitted: {submittedDate}
              </p>
            </div>
          </div>
        </div>
        {/* Selected Furniture Design */}
        {project.catalogue_design_id && (
          <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 mb-6">
            <h2 className="text-xl font-semibold text-[#3d281c] mb-5">
              Selected Furniture Design
            </h2>

            <div className="flex flex-col sm:flex-row gap-5">
              {project.catalogue_design_image_url && (
                <img
                  src={project.catalogue_design_image_url}
                  alt={project.catalogue_design_name || "Selected furniture"}
                  className="w-full sm:w-64 h-48 rounded-xl object-cover"
                />
              )}

              <div className="flex-1">
                <h3 className="text-xl font-serif font-semibold text-[#3d281c]">
                  {project.catalogue_design_name || project.furniture_type || "Selected Furniture"}
                </h3>

                <p className="text-sm text-gray-500 mt-2">
                  Design ID: {project.catalogue_design_id}
                </p>

                {project.preferred_material && (
                  <p className="text-sm text-gray-600 mt-3">
                    Preferred Material: {project.preferred_material}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Customer Reference Image */}
        {project.reference_image_url && (
          <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 mb-6">
            <h2 className="text-xl font-semibold text-[#3d281c] mb-5">
              Your Reference Image
            </h2>

            <a
              href={project.reference_image_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={project.reference_image_url}
                alt="Customer reference furniture"
                className="w-full max-w-md h-64 rounded-xl object-contain bg-[#f8f5ef] border border-[#e7dccd]"
              />
            </a>

            <p className="text-sm text-gray-500 mt-3">
              Image uploaded with your furniture enquiry.
            </p>
          </div>
        )}

        {/* Project Progress */}
        <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 mb-6">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-[#3d281c]">
              Project Progress
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Track the progress of your custom furniture project.
            </p>
          </div>

          {isRejected ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-4">
                <div className="text-3xl">❌</div>

                <div>
                  <h3 className="font-semibold text-red-800">
                    Request Rejected
                  </h3>

                  <p className="text-sm text-red-700 mt-1">
                    Please contact Gavika Furnitech for more
                    information.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Desktop Timeline */}
              <div className="hidden md:block">
                <div className="relative">
                  <div className="absolute top-7 left-[8%] right-[8%] h-1 bg-[#e7dccd]" />

                  <div
                    className="absolute top-7 left-[8%] h-1 bg-[#8b5e3c] transition-all duration-500"
                    style={{
                      width:
                        currentStep >= 5
                          ? "84%"
                          : currentStep === 4
                          ? "67%"
                          : currentStep === 3
                          ? "50%"
                          : currentStep === 2
                          ? "33%"
                          : currentStep === 1
                          ? "17%"
                          : "0%",
                    }}
                  />

                  <div className="relative grid grid-cols-6 gap-2">
                    {progressSteps.map(
                      (step, index) => {
                        const completed =
                          index < currentStep;

                        const active =
                          index === currentStep;

                        return (
                          <div
                            key={step.key}
                            className="flex flex-col items-center text-center"
                          >
                            <div
                              className={`h-14 w-14 rounded-full flex items-center justify-center text-2xl border-4 border-white shadow-sm z-10 ${
                                completed
                                  ? "bg-[#8b5e3c] text-white"
                                  : active
                                  ? "bg-[#5a3927] text-white ring-4 ring-[#d9c6b4]"
                                  : "bg-[#eee4d8] text-gray-500"
                              }`}
                            >
                              {completed
                                ? "✓"
                                : step.icon}
                            </div>

                            <h3
                              className={`mt-4 text-sm font-semibold ${
                                completed || active
                                  ? "text-[#3d281c]"
                                  : "text-gray-400"
                              }`}
                            >
                              {step.title}
                            </h3>

                            <p className="text-xs text-gray-500 mt-1 max-w-[130px]">
                              {completed || active
                                ? step.description
                                : "Pending"}
                            </p>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Timeline */}
              <div className="md:hidden space-y-4">
                {progressSteps.map(
                  (step, index) => {
                    const completed =
                      index < currentStep;

                    const active =
                      index === currentStep;

                    return (
                      <div
                        key={step.key}
                        className={`flex items-start gap-4 rounded-xl p-4 border ${
                          active
                            ? "border-[#8b5e3c] bg-[#faf7f2]"
                            : completed
                            ? "border-[#e7dccd] bg-white"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div
                          className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-xl ${
                            completed
                              ? "bg-[#8b5e3c] text-white"
                              : active
                              ? "bg-[#5a3927] text-white"
                              : "bg-[#eee4d8] text-gray-500"
                          }`}
                        >
                          {completed
                            ? "✓"
                            : step.icon}
                        </div>

                        <div>
                          <h3 className="font-semibold text-[#3d281c]">
                            {step.title}
                          </h3>

                          <p className="text-sm text-gray-500 mt-1">
                            {completed || active
                              ? step.description
                              : "Pending"}
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {/* Current Status */}
              <div className="mt-8 rounded-xl bg-[#faf7f2] border border-[#e7dccd] p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Current Status
                </p>

                <p className="text-lg font-semibold text-[#5a3927] mt-2">
                  {project.status || "New"}
                </p>

                <p className="text-sm text-gray-600 mt-1">
                  {progressSteps[
                    Math.min(
                      currentStep,
                      progressSteps.length - 1
                    )
                  ]?.description ||
                    "Your request has been received."}
                </p>
              </div>
            </div>
          )}
        </div>

        {project.reference_image_url && (
          <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 mb-6">
            <h2 className="text-xl font-semibold text-[#3d281c] mb-4">Your Reference Image</h2>
            <img src={project.reference_image_url} alt="Customer reference" className="w-full max-h-[520px] object-contain rounded-xl border border-gray-200 bg-[#faf7f2]" />
            <a href={project.reference_image_url} target="_blank" rel="noopener noreferrer" className="inline-flex mt-4 rounded-lg bg-[#5a3927] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#432a1e]">Open Full Image ↗</a>
          </div>
        )}

        {/* Project Details */}
        <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 mb-6">
          <h2 className="text-xl font-semibold text-[#3d281c] mb-6">
            Project Details
          </h2>

          <div className="grid sm:grid-cols-2 gap-5">
            <DetailItem
              label="Furniture Type"
              value={project.furniture_type}
            />

            <DetailItem
              label="Room / Usage"
              value={project.room_usage}
            />

            <DetailItem
              label="Preferred Material"
              value={project.preferred_material}
            />

            <DetailItem
              label="Dimensions"
              value={dimensions}
            />

            <DetailItem
              label="Delivery Location"
              value={project.delivery_location}
            />

            <DetailItem
              label="Project Status"
              value={project.status || "New"}
            />
          </div>
        </div>

        {/* Requirement */}
        <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 mb-6">
          <h2 className="text-xl font-semibold text-[#3d281c] mb-4">
            Your Requirement
          </h2>

          <div className="rounded-xl bg-[#faf7f2] p-5">
            <p className="text-gray-700 whitespace-pre-wrap leading-7">
              {project.requirement ||
                "No additional requirement provided."}
            </p>
          </div>
        </div>

        {/* Quotation */}
        <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[#3d281c]">
                Your Quotation
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Quotation details from Gavika Furnitech
              </p>
            </div>

            <div className="text-3xl">
              💰
            </div>
          </div>

          {quotationLoading ? (
            <div className="rounded-xl bg-[#faf7f2] p-6 text-center">
              <div className="inline-flex items-center gap-3 text-[#5a3927]">
                <span className="h-5 w-5 border-2 border-[#5a3927]/30 border-t-[#5a3927] rounded-full animate-spin" />

                <span>
                  Checking quotation...
                </span>
              </div>
            </div>
          ) : !quotation ? (
            <div className="rounded-xl border border-dashed border-[#d8c8b8] bg-[#faf7f2] p-6 text-center">
              <div className="text-3xl mb-3">
                ⏳
              </div>

              <h3 className="font-semibold text-[#3d281c]">
                Waiting for quotation
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Our team is reviewing your requirement.
                The quotation will appear here once it is created.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Quotation Number */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#faf7f2] p-5">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Quotation Number
                  </p>

                  <p className="text-lg font-semibold text-[#5a3927] mt-1">
                    {quotation.quotation_number}
                  </p>
                </div>

                <QuotationStatus status={quotation.status} />
              </div>

              {/* Amount */}
              <div className="rounded-xl border border-[#e7dccd] p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Quotation Amount
                </p>

                <p className="text-3xl font-semibold text-[#3d281c] mt-2">
                  ₹
                  {Number(
                    quotation.amount
                  ).toLocaleString("en-IN")}
                </p>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Description
                </p>

                <div className="mt-2 rounded-xl bg-[#faf7f2] border border-[#e7dccd] p-5">
                  <p className="text-gray-700 whitespace-pre-wrap leading-7">
                    {quotation.description ||
                      "No additional quotation description provided."}
                  </p>
                </div>
              </div>
                  
              {quotation.drawing_url && (
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

                  {quotation.drawing_url.toLowerCase().includes(".pdf") ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                      <p className="text-gray-700 mb-4">
                        Your drawing is ready to view.
                      </p>
                      <a
                        href={quotation.drawing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg bg-[#5a3927] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#432a1e]"
                      >
                        View Drawing PDF ↗
                      </a>
                    </div>
                  ) : (
                    <img
                      src={quotation.drawing_url}
                      alt={
                        quotation.drawing_name ||
                        "Drawing from Gavika Furnitech"
                      }
                      className="w-full max-h-[600px] object-contain rounded-xl border border-gray-200 bg-white"
                    />
                  )}

                  <a
                    href={quotation.drawing_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex mt-4 text-sm font-medium text-[#7a5235] hover:underline"
                  >
                    Open Full Drawing ↗
                  </a>
                </div>
              )}

              {quotation.status === "Pending" && (
                <div className="rounded-xl border border-[#e7dccd] bg-[#faf7f2] p-5">
                  <p className="font-semibold text-[#3d281c]">Review & Final Decision</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Please review the quotation and the drawing above before confirming your decision.
                  </p>

                  {error && (
                    <p className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 mt-5">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleQuotationDecision("Approved")}
                      className="flex-1 rounded-lg bg-[#5a3927] text-white px-5 py-3 text-sm font-semibold hover:bg-[#432a1e] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? "Updating..." : "Approve Quotation & Confirm"}
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleQuotationDecision("Rejected")}
                      className="flex-1 rounded-lg border border-red-300 bg-white text-red-700 px-5 py-3 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reject Quotation
                    </button>
                  </div>
                </div>
              )}

              {/* Validity + Date */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#faf7f2] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Validity
                  </p>

                  <p className="font-semibold text-gray-900 mt-2">
                    {quotation.validity_days} days
                  </p>
                </div>

                <div className="rounded-xl bg-[#faf7f2] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Created On
                  </p>

                  <p className="font-semibold text-gray-900 mt-2">
                    {new Date(
                      quotation.created_at
                    ).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Future Actions */}
        <div className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-semibold text-[#3d281c] mb-4">
            Project Documents & Actions
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <FutureFeature
              icon="📐"
              title="3D Design & Drawing"
            />

            <FutureFeature
              icon="💳"
              title="Advance Payment"
            />

            <FutureFeature
              icon="💬"
              title="Messages"
            />

            <FutureFeature
              icon="📄"
              title="Project Documents"
            />
          </div>

          <p className="text-xs text-gray-400 mt-6">
            These features will become available as your
            project moves forward.
          </p>
        </div>
      </section>
    </main>
  );
}

interface DetailItemProps {
  label: string;
  value: string | null;
}

function DetailItem({
  label,
  value,
}: DetailItemProps) {
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

interface QuotationStatusProps {
  status: Quotation["status"];
}

function QuotationStatus({
  status,
}: QuotationStatusProps) {
  const classes =
    status === "Approved"
      ? "bg-green-100 text-green-800"
      : status === "Rejected"
      ? "bg-red-100 text-red-800"
      : status === "Expired"
      ? "bg-gray-100 text-gray-700"
      : "bg-yellow-100 text-yellow-800";

  return (
    <span
      className={`inline-flex rounded-full px-4 py-2 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

interface FutureFeatureProps {
  icon: string;
  title: string;
}

function FutureFeature({
  icon,
  title,
}: FutureFeatureProps) {
  return (
    <div className="rounded-xl border border-[#e7dccd] bg-gray-50 p-5 opacity-70">
      <div className="text-3xl mb-3">
        {icon}
      </div>

      <h3 className="font-semibold text-[#3d281c]">
        {title}
      </h3>

      <span className="inline-block mt-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
        ⏳ Coming Soon
      </span>
    </div>
  );
}