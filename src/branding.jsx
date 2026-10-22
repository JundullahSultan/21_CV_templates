import React from "react";

export const creator = "Jundullah Sultan";
export const whatsappNumber = "+93708176837";
export const whatsappUrl = "https://wa.me/93708176837";

const copy = {
  en: {
    by: "Created by",
    contact: "Contact on WhatsApp",
    support: "Need a hand with your CV?",
  },
  ps: {
    by: "جوړوونکی",
    contact: "په واټساپ اړیکه",
    support: "د سي وي په جوړولو کې مرسته غواړئ؟",
  },
  fa: {
    by: "ساخته‌شده توسط",
    contact: "تماس در واتساپ",
    support: "برای ساخت رزومه کمک می‌خواهید؟",
  },
};

export function BrandMark({ className = "", decorative = true }) {
  return (
    <img
      className={`brand-mark ${className}`}
      src="/branding/logo.png"
      alt={decorative ? "" : "CV Studio logo"}
      width="44"
      height="44"
    />
  );
}

export function CreatorSupport({ language }) {
  const text = copy[language] || copy.en;
  return (
    <div className="creator-support">
      <BrandMark />
      <div>
        <strong>{text.support}</strong>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          {text.contact} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}

export function AppFooter({ language }) {
  const text = copy[language] || copy.en;
  return (
    <footer className="app-footer">
      <div className="footer-identity">
        <BrandMark />
        <div>
          <strong>CV Studio</strong>
          <p>
            {text.by} <bdi>{creator}</bdi>
          </p>
        </div>
      </div>
      <a
        className="whatsapp-contact"
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>{text.contact}</span>
        <bdi dir="ltr">{whatsappNumber}</bdi>
        <span aria-hidden="true">↗</span>
      </a>
    </footer>
  );
}
