import React from "react";
import { useLang } from "@/hooks/use-lang";

const SiteFooter: React.FC = () => {
  // Fixed year per request
  const year = 2025;
  const { isEnglish } = useLang();
  const text = isEnglish
    ? `© ${year} Red Sea Bridge Festival`
    : `© פסטיבל הברידג' בים האדום ${year}`;

  return (
    <footer className="w-full max-w-2xl mx-auto mt-8 mb-6 px-4">
      <div className="text-center text-xs text-muted-foreground pt-3">
        {text}
      </div>
    </footer>
  );
};

export default SiteFooter;
