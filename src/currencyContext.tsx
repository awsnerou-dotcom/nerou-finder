import React, { createContext, useContext, useState, useEffect } from "react";

export type CurrencyCode = "QAR" | "USD" | "AED" | "SAR";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  symbolAr: string;
  rate: number; // Multiply QAR by this to get value in target currency
  label: string;
  labelAr: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  QAR: {
    code: "QAR",
    symbol: "QAR",
    symbolAr: "ر.ق",
    rate: 1.0,
    label: "Qatari Riyal",
    labelAr: "ريال قطري",
  },
  USD: {
    code: "USD",
    symbol: "$",
    symbolAr: "$",
    rate: 0.274725, // 1 / 3.64
    label: "US Dollar",
    labelAr: "دولار أمريكي",
  },
  AED: {
    code: "AED",
    symbol: "AED",
    symbolAr: "د.إ",
    rate: 1.009,
    label: "UAE Dirham",
    labelAr: "درهم إماراتي",
  },
  SAR: {
    code: "SAR",
    symbol: "SAR",
    symbolAr: "ر.س",
    rate: 1.030,
    label: "Saudi Riyal",
    labelAr: "ريال سعودي",
  },
};

interface CurrencyContextProps {
  activeCurrency: CurrencyCode;
  setActiveCurrency: (code: CurrencyCode) => void;
  formatPrice: (priceInQar: number, isRtl: boolean) => string;
  convertPrice: (priceInQar: number) => number;
  getCurrencySymbol: (isRtl: boolean) => string;
}

const CurrencyContext = createContext<CurrencyContextProps | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCurrency, setActiveCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem("nerou_active_currency");
    return (saved as CurrencyCode) || "QAR";
  });

  const setActiveCurrency = (code: CurrencyCode) => {
    setActiveCurrencyState(code);
    localStorage.setItem("nerou_active_currency", code);
  };

  const convertPrice = (priceInQar: number): number => {
    const config = CURRENCIES[activeCurrency];
    return priceInQar * config.rate;
  };

  const getCurrencySymbol = (isRtl: boolean): string => {
    const config = CURRENCIES[activeCurrency];
    return isRtl ? config.symbolAr : config.symbol;
  };

  const formatPrice = (priceInQar: number, isRtl: boolean): string => {
    const converted = convertPrice(priceInQar);
    const symbol = getCurrencySymbol(isRtl);
    
    // Format nicely with thousand separators and optional decimals for USD
    const formattedVal = converted.toLocaleString(undefined, {
      maximumFractionDigits: activeCurrency === "USD" ? 2 : 0,
    });

    return isRtl ? `${formattedVal} ${symbol}` : `${symbol} ${formattedVal}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        activeCurrency,
        setActiveCurrency,
        formatPrice,
        convertPrice,
        getCurrencySymbol,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
};
