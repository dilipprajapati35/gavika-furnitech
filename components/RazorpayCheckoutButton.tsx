"use client";

import { useState } from "react";

interface RazorpayCheckoutButtonProps {
  amount: number; // in paise (e.g. 10000 = ₹100.00) or rupees if specified
  currency?: string;
  name?: string;
  description?: string;
  image?: string;
  receipt?: string;
  notes?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess?: (paymentData: {
    order_id: string;
    payment_id: string;
    signature: string;
    verified: boolean;
  }) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export default function RazorpayCheckoutButton({
  amount,
  currency = "INR",
  name = "Gavika Furnitech",
  description = "Custom Furniture Order",
  image = "/Gavika-new-logo.png",
  receipt,
  notes,
  prefill,
  onSuccess,
  onError,
  className = "inline-flex items-center justify-center rounded-xl bg-[#29251f] hover:bg-[#7a5235] text-white px-5 py-3 text-sm font-semibold transition active:scale-98 shadow-md disabled:opacity-50",
  disabled = false,
  children = "Pay with Razorpay",
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadRazorpayScript = () => {
    return new Promise<boolean>((resolve) => {
      if (typeof window !== "undefined" && (window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      // Validate minimum 100 paise
      const amountInPaise = amount < 100 ? 100 : Math.round(amount);

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        const err = "Failed to load Razorpay SDK. Please check your network.";
        setErrorMessage(err);
        onError?.(err);
        setLoading(false);
        return;
      }

      // Step 1: Call Create Order endpoint
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountInPaise,
          currency,
          receipt: receipt || `rcpt_${Date.now()}`,
          notes: notes || {},
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.order_id) {
        const err = orderData.error || "Failed to create Razorpay order.";
        setErrorMessage(err);
        onError?.(err);
        setLoading(false);
        return;
      }

      // Step 2: Open Razorpay Checkout Modal
      const options = {
        key:
          orderData.key_id ||
          orderData.keyId ||
          process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || currency,
        name,
        description,
        image,
        order_id: orderData.order_id,
        prefill: {
          name: prefill?.name || "",
          email: prefill?.email || "",
          contact: prefill?.contact || "",
        },
        theme: {
          color: "#3d281c",
        },
        handler: async function (response: any) {
          try {
            // Step 3: Verify Payment Signature
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderDetails: {
                  amount: amount < 100 ? amount : amount / 100,
                  customer_name: prefill?.name || "Customer",
                  customer_email: prefill?.email || null,
                  customer_mobile: prefill?.contact || null,
                  product_name: description || name || "Furniture Order",
                },
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              onSuccess?.({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                verified: true,
              });
            } else {
              const err = verifyData.error || "Payment signature verification failed.";
              setErrorMessage(err);
              onError?.(err);
            }
          } catch (err: any) {
            const msg = err.message || "Error verifying payment signature.";
            setErrorMessage(msg);
            onError?.(msg);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        const failMsg =
          response.error?.description || "Payment failed or was declined.";
        setErrorMessage(`Payment Failed: ${failMsg}`);
        onError?.(failMsg);
        setLoading(false);
      });
      rzp.open();
    } catch (err: any) {
      const msg = err.message || "An unexpected error occurred during checkout.";
      setErrorMessage(msg);
      onError?.(msg);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={handlePayment}
        disabled={loading || disabled}
        className={className}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Processing...</span>
          </span>
        ) : (
          children
        )}
      </button>
      {errorMessage && (
        <p className="mt-2 text-xs text-rose-600 font-medium text-center">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
