import { cn } from "@/lib/utils";

interface BridgeSymbolsProps {
  className?: string;
}

const BridgeSymbols = ({ className }: BridgeSymbolsProps) => {
  const symbols = ["♣", "♥", "♦", "♠"];
  
  return (
    <div className={cn("flex items-center justify-center gap-4 text-3xl", className)}>
      {symbols.map((symbol, index) => (
        <span
          key={index}
          className={cn(
            "animate-pulse font-bold transition-all duration-300 hover:scale-110",
            symbol === "♥" || symbol === "♦" ? "text-bridge-red" : "text-bridge-black"
          )}
          style={{ animationDelay: `${index * 0.5}s` }}
        >
          {symbol}
        </span>
      ))}
    </div>
  );
};

export default BridgeSymbols;