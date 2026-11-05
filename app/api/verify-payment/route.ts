import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const order_id = body.order_id || body.razorpay_order_id;
    const payment_id = body.payment_id || body.razorpay_payment_id;
    const signature = body.signature || body.razorpay_signature;
    const orderDetails = body.orderDetails;
    const accessToken = body.access_token;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Razorpay Key Secret is not configured in .env",
        },
        { status: 401 }
      );
    }

    // Missing fields: return 400
    if (!order_id || !payment_id || !signature) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: order_id, payment_id, and signature are required.",
        },
        { status: 400 }
      );
    }

    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(`${order_id}|${payment_id}`);
    const generatedSignature = hmac.digest("hex");

    // Signature mismatch: return 400, do NOT mark as paid
    if (generatedSignature !== signature) {
      return NextResponse.json(
        {
          success: false,
          error: "Signature mismatch: payment verification failed.",
        },
        { status: 400 }
      );
    }

    // If order details are provided, record to Supabase orders table
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    if (orderDetails) {
      try {
        let db = supabase;
        if (accessToken) {
          try {
            db = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
              {
                global: {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                },
                auth: { persistSession: false },
              }
            );
          } catch (clientErr) {
            console.warn("Could not create token-authenticated Supabase client:", clientErr);
          }
        }

        let effectiveUserId = orderDetails.user_id || null;

        // If user_id is not passed, search for matching user by email
        if (!effectiveUserId && orderDetails.customer_email) {
          try {
            const { data: userReq } = await supabase
              .from("custom_requests")
              .select("user_id")
              .ilike("email", orderDetails.customer_email.trim())
              .not("user_id", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (userReq?.user_id) {
              effectiveUserId = userReq.user_id;
            }
          } catch {}
        }

        // If still not found, check admin user as fallback
        if (!effectiveUserId) {
          try {
            const { data: adminRow } = await supabase
              .from("admin_users")
              .select("user_id")
              .limit(1)
              .maybeSingle();
            if (adminRow?.user_id) {
              effectiveUserId = adminRow.user_id;
            }
          } catch {}
        }

        let customRequestId: string | null = null;
        let quotationId: string | null = null;

        // 1. Create a matching custom_request so foreign keys and relations in Admin & Customer Account join properly
        if (effectiveUserId) {
          try {
            const reqNumber = `REQ-${Date.now().toString().slice(-6)}`;
            const { data: reqData, error: reqErr } = await db
              .from("custom_requests")
              .insert({
                request_id: reqNumber,
                user_id: effectiveUserId,
                full_name: orderDetails.customer_name || "Customer",
                mobile: orderDetails.customer_mobile || "",
                email: orderDetails.customer_email || null,
                furniture_type: orderDetails.product_name || "Direct Purchase",
                catalogue_design_name: orderDetails.product_name || null,
                catalogue_design_id: orderDetails.product_id || null,
                catalogue_design_image_url: orderDetails.product_image || null,
                delivery_location: orderDetails.delivery_address || null,
                requirement: `Direct online purchase via Razorpay (Payment: ${payment_id})`,
                status: "Order Confirmed",
              })
              .select("id")
              .maybeSingle();

            if (!reqErr && reqData?.id) {
              customRequestId = reqData.id;

              // 2. Create matching quotation for the order relation
              const quoteNumber = `QT-${Date.now().toString().slice(-6)}`;
              const { data: quoteData } = await db
                .from("quotations")
                .insert({
                  request_id: customRequestId,
                  quotation_number: quoteNumber,
                  amount: Number(orderDetails.amount) || 0,
                  description: `Direct purchase order for ${orderDetails.product_name || "Catalogue Item"}`,
                  status: "Approved",
                })
                .select("id")
                .maybeSingle();

              if (quoteData?.id) {
                quotationId = quoteData.id;
              }
            }
          } catch (e) {
            console.warn("Could not create linked request/quotation:", e);
          }
        }

        // 3. Insert into orders table with all available data
        const orderData: any = {
          order_number: orderNumber,
          amount: Number(orderDetails.amount) || 0,
          status: "Confirmed",
          delivery_address: orderDetails.delivery_address || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (effectiveUserId) orderData.user_id = effectiveUserId;
        if (customRequestId) orderData.request_id = customRequestId;
        if (quotationId) orderData.quotation_id = quotationId;

        // Try insert with linked relations
        const { error: dbError } = await db
          .from("orders")
          .insert(orderData);

        if (dbError) {
          console.warn("Could not record order with relations, attempting fallback:", dbError.message);
          // Fallback insert with minimal required fields
          const fallbackData: any = {
            order_number: orderNumber,
            amount: Number(orderDetails.amount) || 0,
            status: "Confirmed",
            delivery_address: orderDetails.delivery_address || null,
          };
          if (effectiveUserId) fallbackData.user_id = effectiveUserId;
          await db.from("orders").insert(fallbackData);
        }
      } catch (err) {
        console.warn("Exception while recording order:", err);
      }
    }

    return NextResponse.json({
      success: true,
      verified: true,
      orderNumber,
      order_id,
      payment_id,
      message: "Payment successfully verified.",
    });
  } catch (error: any) {
    console.error("Payment verification exception:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to verify payment with server.",
      },
      { status: 500 }
    );
  }
}
