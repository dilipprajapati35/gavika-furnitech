import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      amount,
      currency = "INR",
      receipt,
      notes,
    } = body;

    const keyId = (
      process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ""
    ).trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Razorpay credentials not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env",
        },
        { status: 401 }
      );
    }

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount < 100) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid amount. Minimum amount must be at least 100 paise.",
        },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(numAmount),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    });

    return NextResponse.json({
      success: true,
      order_id: order.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      key_id: keyId,
    });
  } catch (error: any) {
    console.error("Error creating Razorpay order:", error);

    // Authentication failure check
    if (
      error.statusCode === 401 ||
      error.status === 401 ||
      (typeof error.message === "string" &&
        error.message.toLowerCase().includes("authentication")) ||
      (error.error?.code === "BAD_REQUEST_ERROR" &&
        error.error?.description?.includes("Unauthorized"))
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            error.error?.description ||
            error.message ||
            "Razorpay authentication failed. Please check credentials.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error.error?.description ||
          error.message ||
          "Failed to create order with Razorpay.",
      },
      { status: 500 }
    );
  }
}
