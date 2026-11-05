"use client";

import { useState } from "react";
import RazorpayCheckoutButton from "@/components/RazorpayCheckoutButton";

export default function CheckoutTestPage() {
  const [testAmount, setTestAmount] = useState<number>(50000); // 50000 paise = ₹500
  const [successInfo, setSuccessInfo] = useState<{
    order_id: string;
    payment_id: string;
    signature: string;
  } | null>(null);
  const [errorInfo, setErrorInfo] = useState<string>("");

  return (
    <div className="min-h-screen bg-[#faf7f2] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto bg-white rounded-3xl border border-[#e7dccd] shadow-lg p-6 sm:p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#f5efe6] flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
            💳
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#3d281c]">
            Razorpay Standard Checkout Test
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Test Razorpay Web Checkout Integration
          </p>
        </div>

        {/* Credentials & Test Data Info Box */}
        <div className="rounded-2xl bg-[#fbf9f5] border border-[#e7dccd] p-4 mb-6 text-xs text-stone-700 space-y-2">
          <p className="font-semibold text-[#3d281c] flex items-center gap-1.5">
            <span>ℹ️</span> Test Credentials & Instruments
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="bg-white p-2.5 rounded-xl border border-stone-200">
              <span className="font-semibold text-stone-500 block mb-0.5">Test Card</span>
              <p className="font-mono font-medium">4100 2800 0000 1007</p>
              <p className="text-stone-500 text-[10px]">CVV: 123 · Exp: 12/26</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-stone-200">
              <span className="font-semibold text-stone-500 block mb-0.5">Test UPI</span>
              <p className="font-mono font-medium">test@razorpay</p>
              <p className="text-stone-500 text-[10px]">Instant approval</p>
            </div>
          </div>
        </div>

        {/* Amount Selector */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
            Payment Amount
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "₹1.00 (100p)", paise: 100 },
              { label: "₹100 (10000p)", paise: 10000 },
              { label: "₹500 (50000p)", paise: 50000 },
            ].map((opt) => (
              <button
                key={opt.paise}
                type="button"
                onClick={() => {
                  setTestAmount(opt.paise);
                  setSuccessInfo(null);
                  setErrorInfo("");
                }}
                className={`py-2 px-3 text-xs rounded-xl font-medium border transition ${
                  testAmount === opt.paise
                    ? "bg-[#3d281c] text-white border-[#3d281c] shadow-xs"
                    : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Success Alert */}
        {successInfo && (
          <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-900 text-xs space-y-1">
            <p className="font-bold text-sm flex items-center gap-1.5 text-emerald-700">
              <span>✅</span> Payment & Signature Verified!
            </p>
            <p><span className="font-semibold">Order ID:</span> {successInfo.order_id}</p>
            <p><span className="font-semibold">Payment ID:</span> {successInfo.payment_id}</p>
            <p className="truncate"><span className="font-semibold">Signature:</span> {successInfo.signature}</p>
          </div>
        )}

        {/* Error Alert */}
        {errorInfo && (
          <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-rose-900 text-xs">
            <p className="font-bold text-sm flex items-center gap-1.5 text-rose-700 mb-1">
              <span>⚠️</span> Error
            </p>
            <p>{errorInfo}</p>
          </div>
        )}

        {/* Standard Checkout Button */}
        <div className="mt-8 pt-4 border-t border-stone-200 flex flex-col items-center">
          <RazorpayCheckoutButton
            amount={testAmount}
            name="Gavika Furnitech"
            description="Test Order Verification"
            prefill={{
              name: "Test User",
              email: "test@example.com",
              contact: "9999999999",
            }}
            onSuccess={(data) => {
              setSuccessInfo(data);
              setErrorInfo("");
            }}
            onError={(err) => {
              setErrorInfo(err);
            }}
            className="w-full py-3.5 px-6 rounded-xl bg-[#29251f] hover:bg-[#7a5235] text-white text-sm font-semibold transition active:scale-98 shadow-md flex items-center justify-center gap-2"
          >
            <span>Pay ₹{(testAmount / 100).toFixed(2)} with Razorpay</span>
          </RazorpayCheckoutButton>

          <a
            href="/"
            className="mt-4 text-xs font-semibold text-stone-500 hover:text-stone-800 transition"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
