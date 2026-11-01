import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/utils/supabase/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderDetails,
    } = body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Razorpay Key Secret is not configured. Please add RAZORPAY_KEY_SECRET in .env.",
        },
        { status: 400 }
      );
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: "Missing required payment verification details." },
        { status: 400 }
      );
    }

    // Verify HMAC SHA256 signature
    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, error: "Payment verification failed. Invalid signature." },
        { status: 400 }
      );
    }

    // Generate readable Order Number
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    // Try saving order to Supabase orders table
    if (orderDetails) {
      try {
        const orderData: any = {
          order_number: orderNumber,
          amount: orderDetails.amount,
          status: "Confirmed",
          delivery_address: orderDetails.delivery_address || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (orderDetails.user_id) {
          orderData.user_id = orderDetails.user_id;
        }

        const { error: dbError } = await supabase
          .from("orders")
          .insert(orderData);

        if (dbError) {
          console.warn("Could not record order to orders table:", dbError.message);
        }
      } catch (err) {
        console.warn("Exception while recording order:", err);
      }
    }

    return NextResponse.json({
      success: true,
      verified: true,
      orderNumber,
      paymentId: razorpay_payment_id,
      message: "Payment successfully verified and confirmed.",
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
