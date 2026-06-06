interface DepositBannerProps {
  isSupplyOnly: boolean;
  depositAmount: number;
  totalAmount: number;
}

export function DepositBanner({ isSupplyOnly, depositAmount, totalAmount }: DepositBannerProps) {
  const formatPrice = (val: number) =>
    `$${new Intl.NumberFormat("en-AU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val)}`;

  const refundTerms = isSupplyOnly
    ? "refundable until 24h before pickup · balance on pickup"
    : "refundable until 48h before install · balance on completion";

  return (
    <div className="deposit-banner bg-slate-900 text-white rounded-xl p-4 flex gap-4 items-center mb-5 select-none">
      <div className="deposit-banner__icon w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-lg shrink-0">
        🔒
      </div>
      <div className="deposit-banner__body min-w-0 flex-1 leading-tight">
        <div className="deposit-banner__title text-[10px] tracking-wider uppercase text-white/60 font-semibold mb-0.5">
          10% deposit today
        </div>
        <div className="deposit-banner__amount font-mono text-2xl font-extrabold text-white">
          {formatPrice(depositAmount)}
        </div>
        <div className="deposit-banner__sub text-[11px] text-white/65 mt-1 font-mono">
          of {formatPrice(totalAmount)} total · {refundTerms}
        </div>
      </div>
    </div>
  );
}
