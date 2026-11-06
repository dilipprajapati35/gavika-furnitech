import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceClient } from "@/utils/supabase/client";

// Ensure Next.js doesn't parse or cache webhook payloads
export const dynamic = "force-dynamic";

/**
 * Razorpay Webhook Handler
 * Endpoint: POST /api/razorpay/webhook
 *
 * Supported Events:
 * - payment.captured : Successful payment confirmation & order status update
 * - payment.failed   : Failed payment capture & failure error recording
 * - order.paid       : Order fully paid confirmation
 */
export async function POST(request: Request) {
  try {
    const supabase = getServiceClient();

    // 1. Extract signature from headers
    const signature = request.headers.get("x-razorpay-signature");
    const eventIdHeader = request.headers.get("x-razorpay-event-id");

    if (!signature) {
      console.warn("[Razorpay Webhook] Missing x-razorpay-signature header");
      return NextResponse.json(
        { success: false, error: "Missing x-razorpay-signature header." },
        { status: 400 }
      );
    }

    // 2. Secret Configuration
    const webhookSecret = (
      process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || ""
    ).trim();

    if (!webhookSecret) {
      console.error(
        "[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured in server environment."
      );
      return NextResponse.json(
        {
          success: false,
          error: "Webhook secret is not configured on the server.",
        },
        { status: 500 }
      );
    }

    // 3. Read RAW Request Body (CRITICAL: Do NOT use request.json() before HMAC verification)
    const rawBody = await request.text();

    if (!rawBody || rawBody.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Empty webhook payload." },
        { status: 400 }
      );
    }

    // 4. Cryptographic HMAC SHA256 Signature Verification
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    const isValidSignature =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValidSignature) {
      console.error("[Razorpay Webhook] Cryptographic signature mismatch!");
      return NextResponse.json(
        {
          success: false,
          error: "Invalid webhook signature. Request rejected.",
        },
        { status: 400 }
      );
    }

    // 5. Parse Webhook Event JSON
    let eventPayload: any;
    try {
      eventPayload = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("[Razorpay Webhook] Failed to parse JSON:", parseErr);
      return NextResponse.json(
        { success: false, error: "Malformed JSON payload." },
        { status: 400 }
      );
    }

    const eventName: string = eventPayload.event || "";
    const eventId: string =
      eventIdHeader ||
      eventPayload.id ||
      eventPayload.event_id ||
      `evt_${eventName}_${Date.now()}`;
    const accountId: string = eventPayload.account_id || "";

    console.log(
      `[Razorpay Webhook] Verified event received: ${eventName} (ID: ${eventId})`
    );

    // 6. Idempotency Check: Prevent duplicate event processing
    try {
      const { data: existingEvent } = await supabase
        .from("razorpay_webhook_events")
        .select("id, processed")
        .eq("event_id", eventId)
        .maybeSingle();

      if (existingEvent && existingEvent.processed) {
        console.log(
          `[Razorpay Webhook] Event ${eventId} was already processed. Returning cached success.`
        );
        return NextResponse.json({
          success: true,
          message: "Event already processed (idempotent).",
          event: eventName,
          eventId,
        });
      }

      if (!existingEvent) {
        await supabase.from("razorpay_webhook_events").insert({
          event_id: eventId,
          event_type: eventName,
          account_id: accountId,
          payload: eventPayload,
          processed: false,
        });
      }
    } catch (idempErr) {
      console.warn("[Razorpay Webhook] Note on idempotency check:", idempErr);
    }

    // 7. Handle Specific Webhook Events
    if (eventName === "payment.captured") {
      const payment = eventPayload.payload?.payment?.entity;
      if (!payment) {
        return NextResponse.json(
          { success: false, error: "Payment entity missing in payload." },
          { status: 400 }
        );
      }

      const paymentId = payment.id;
      const orderId = payment.order_id;
      const amount = Number(payment.amount) / 100; // Convert paise to rupees
      const currency = payment.currency || "INR";
      const method = payment.method || "online";
      const email = payment.email || payment.notes?.customerEmail || null;
      const contact = payment.contact || payment.notes?.customerPhone || null;
      const notes = payment.notes || {};

      let orderRecordId: string | null = null;

      // Check if order already exists in Supabase
      if (orderId) {
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id, order_number, user_id, status")
          .eq("razorpay_order_id", orderId)
          .maybeSingle();

        if (existingOrder) {
          orderRecordId = existingOrder.id;
          // Preserve delivery stage if order is already in production/delivered
          const preserveStatus = [
            "In Production",
            "Ready for Delivery",
            "Out for Delivery",
            "Delivered",
          ].includes(existingOrder.status);

          // Update order status to paid and confirmed
          await supabase
            .from("orders")
            .update({
              status: preserveStatus ? existingOrder.status : "Confirmed",
              payment_status: "paid",
              razorpay_payment_id: paymentId,
              payment_method: method,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingOrder.id);
        }
      }

      // If order was not found by razorpay_order_id, create it from notes
      if (!orderRecordId) {
        let effectiveUserId = notes.userId || null;

        // Fallback user matching by email
        if (!effectiveUserId && email) {
          try {
            const { data: matchedUser } = await supabase
              .from("custom_requests")
              .select("user_id")
              .ilike("email", email.trim())
              .not("user_id", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (matchedUser?.user_id) {
              effectiveUserId = matchedUser.user_id;
            }
          } catch {}
        }

        const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(
          100 + Math.random() * 900
        )}`;

        let customRequestId: string | null = null;
        let quotationId: string | null = null;

        if (effectiveUserId) {
          try {
            const reqNumber = `REQ-${Date.now().toString().slice(-6)}`;
            const { data: reqData } = await supabase
              .from("custom_requests")
              .insert({
                request_id: reqNumber,
                user_id: effectiveUserId,
                full_name: notes.customerName || "Customer",
                mobile: contact || notes.customerPhone || "",
                email: email,
                furniture_type: notes.productName || "Direct Purchase",
                catalogue_design_name: notes.productName || null,
                catalogue_design_id: notes.productId || null,
                delivery_location: notes.deliveryAddress || null,
                requirement: `Direct purchase captured via Razorpay Webhook (Payment: ${paymentId})`,
                status: "Order Confirmed",
              })
              .select("id")
              .maybeSingle();

            if (reqData?.id) {
              customRequestId = reqData.id;
              const { data: quoteData } = await supabase
                .from("quotations")
                .insert({
                  request_id: customRequestId,
                  quotation_number: `QT-${Date.now().toString().slice(-6)}`,
                  amount,
                  description: `Order confirmation for ${notes.productName || "Direct Purchase"}`,
                  status: "Approved",
                })
                .select("id")
                .maybeSingle();

              if (quoteData?.id) {
                quotationId = quoteData.id;
              }
            }
          } catch (relErr) {
            console.warn("[Razorpay Webhook] Linked relation setup note:", relErr);
          }
        }

        try {
          const { data: newOrd } = await supabase
            .from("orders")
            .insert({
              order_number: orderNumber,
              user_id: effectiveUserId,
              request_id: customRequestId,
              quotation_id: quotationId,
              amount,
              status: "Confirmed",
              payment_status: "paid",
              payment_method: method,
              razorpay_order_id: orderId || null,
              razorpay_payment_id: paymentId,
              delivery_address: notes.deliveryAddress || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select("id")
            .maybeSingle();

          if (newOrd?.id) {
            orderRecordId = newOrd.id;
          }
        } catch (insertErr) {
          console.warn("[Razorpay Webhook] Order insertion note:", insertErr);
        }
      }

      // Record transaction in public.payments table
      try {
        await supabase.from("payments").upsert(
          {
            order_id: orderRecordId,
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId || null,
            amount,
            currency,
            status: "captured",
            method,
            customer_email: email,
            customer_phone: contact,
            error_code: null,
            error_description: null,
            raw_response: payment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "razorpay_payment_id" }
        );
      } catch (payErr) {
        console.warn("[Razorpay Webhook] Payments table record note:", payErr);
      }
    } else if (eventName === "order.paid") {
      const order = eventPayload.payload?.order?.entity;
      const payment = eventPayload.payload?.payment?.entity;

      if (order?.id) {
        const orderId = order.id;
        const paymentId = payment?.id || null;
        const method = payment?.method || null;

        const { data: existingOrd } = await supabase
          .from("orders")
          .select("id, status")
          .eq("razorpay_order_id", orderId)
          .maybeSingle();

        if (existingOrd) {
          const preserveStatus = [
            "In Production",
            "Ready for Delivery",
            "Out for Delivery",
            "Delivered",
          ].includes(existingOrd.status);

          await supabase
            .from("orders")
            .update({
              status: preserveStatus ? existingOrd.status : "Confirmed",
              payment_status: "paid",
              ...(paymentId ? { razorpay_payment_id: paymentId } : {}),
              ...(method ? { payment_method: method } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingOrd.id);
        }
      }
    } else if (eventName === "payment.failed") {
      const payment = eventPayload.payload?.payment?.entity;
      if (payment) {
        const paymentId = payment.id;
        const orderId = payment.order_id;
        const amount = Number(payment.amount) / 100;
        const currency = payment.currency || "INR";
        const method = payment.method || "unknown";
        const errorCode = payment.error_code || "PAYMENT_FAILED";
        const errorDescription =
          payment.error_description || "Payment failed or was declined.";
        const email = payment.email || payment.notes?.customerEmail || null;
        const contact = payment.contact || payment.notes?.customerPhone || null;

        // If matching order exists, mark payment_status as failed ONLY if not already paid
        let matchedOrderId: string | null = null;
        if (orderId) {
          const { data: ordRow } = await supabase
            .from("orders")
            .select("id, payment_status")
            .eq("razorpay_order_id", orderId)
            .maybeSingle();

          if (ordRow?.id) {
            matchedOrderId = ordRow.id;
            // CRITICAL: A failed event cannot overwrite an already captured/paid payment
            if (ordRow.payment_status !== "paid") {
              await supabase
                .from("orders")
                .update({
                  payment_status: "failed",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", ordRow.id);
            } else {
              console.log(
                `[Razorpay Webhook] Order ${ordRow.id} is already captured and paid. Preserving paid status.`
              );
            }
          }
        }

        // Record failed payment in payments table
        try {
          await supabase.from("payments").upsert(
            {
              order_id: matchedOrderId,
              razorpay_payment_id: paymentId,
              razorpay_order_id: orderId || null,
              amount,
              currency,
              status: "failed",
              method,
              customer_email: email,
              customer_phone: contact,
              error_code: errorCode,
              error_description: errorDescription,
              raw_response: payment,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "razorpay_payment_id" }
          );
        } catch (payErr) {
          console.warn("[Razorpay Webhook] Failed payment log note:", payErr);
        }
      }
    } else {
      console.log(`[Razorpay Webhook] Unhandled event type acknowledged: ${eventName}`);
    }

    // 8. Mark Webhook Event as Processed (Idempotency completion)
    try {
      await supabase
        .from("razorpay_webhook_events")
        .update({ processed: true })
        .eq("event_id", eventId);
    } catch {}

    // 9. Respond with 200 OK to Razorpay
    return NextResponse.json({
      success: true,
      received: true,
      event: eventName,
      eventId,
    });
  } catch (error: any) {
    console.error("[Razorpay Webhook] Unexpected internal exception:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error processing webhook.",
      },
      { status: 500 }
    );
  }
}

// Optional GET method for health check/verification
export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Razorpay Webhook endpoint is listening. Send POST requests with valid x-razorpay-signature.",
  });
}
