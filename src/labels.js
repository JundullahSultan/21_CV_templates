const labels = {
  ps: {
    allSections: "د سي وي ټولې برخې",
    photo: "انځور بدلول",
    name: "بشپړ نوم",
    role: "مطلوبه دنده",
    phone: "تلیفون",
    email: "برېښنالیک",
    city: "ښار / هېواد",
    portfolio: "لینکډاین / کاري بېلګې",
    summary: "مسلکي لنډیز",
    jobs: "کاري تجربه",
    education: "زده کړې",
    skills: "مهارتونه",
    custom: "ځانګړې برخه",
    languages: "ژبې",
    training: "روزنه / کورسونه",
    projects: "پروژې",
    strengths: "ځواکمنې ځانګړنې",
    volunteering: "رضاکارانه کار",
    industryExpertise: "د صنعت تخصص",
    interests: "لېوالتیاوې",
    myTime: "زما وخت",
    online: "انلاین پتې",
    certifications: "مسلکي سندونه",
    awards: "جایزې",
    references: "معرفان",
    philosophy: "د ژوند لیدلوری",
    publications: "خپرونې",
    books: "کتابونه",
    additionalExperience: "نورې تجربې",
    additionalSkills: "نور مهارتونه",
    additionalPublications: "نورې خپرونې",
    signature: "لاسلیک",
  },
  fa: {
    allSections: "همه بخش‌های رزومه",
    photo: "تعویض عکس",
    name: "نام کامل",
    role: "عنوان شغلی مورد نظر",
    phone: "تلفن",
    email: "ایمیل",
    city: "شهر / کشور",
    portfolio: "لینکدین / نمونه کار",
    summary: "خلاصه حرفه‌ای",
    jobs: "سوابق کاری",
    education: "تحصیلات",
    skills: "مهارت‌ها",
    custom: "بخش دلخواه",
    languages: "زبان‌ها",
    training: "آموزش / دوره‌ها",
    projects: "پروژه‌ها",
    strengths: "نقاط قوت",
    volunteering: "فعالیت داوطلبانه",
    industryExpertise: "تخصص صنعتی",
    interests: "علاقه‌مندی‌ها",
    myTime: "زمان من",
    online: "نشانی‌های آنلاین",
    certifications: "گواهینامه‌ها",
    awards: "جوایز",
    references: "معرف‌ها",
    philosophy: "فلسفه زندگی من",
    publications: "انتشارات",
    books: "کتاب‌ها",
    additionalExperience: "تجربه‌های بیشتر",
    additionalSkills: "مهارت‌های بیشتر",
    additionalPublications: "انتشارات بیشتر",
    signature: "امضا",
  },
};
export const labelFor = (language, key, fallback) =>
  labels[language]?.[key] || fallback;
export const fieldPrompt = (language, label) =>
  language === "ps"
    ? `مهرباني وکړئ «${label}» ولیکئ.`
    : language === "fa"
      ? `لطفاً «${label}» را وارد کنید.`
      : label;
export const descriptionFor = (language, key, fallback) =>
  language === "en"
    ? fallback
    : language === "ps"
      ? `د «${labelFor(language, key, key)}» معلومات ورزیات کړئ. مرستیال به اړینې پوښتنې وکړي.`
      : `اطلاعات «${labelFor(language, key, key)}» را اضافه کنید. دستیار پرسش‌های لازم را می‌پرسد.`;
export const uiCopy = {
  en: {
    eyebrow: "YOUR EXPERIENCE, BEAUTIFULLY TOLD",
    editorEyebrow: "YOUR PERSONAL EDITOR",
    designs: "designs",
    page: "page",
    pages: "pages",
    search: "Search sections",
  },
  ps: {
    eyebrow: "ستاسو تجربه، ستاسو کیسه",
    editorEyebrow: "ستاسو شخصي سمونګر",
    designs: "بڼې",
    page: "پاڼه",
    pages: "پاڼې",
    search: "د برخو لټون",
  },
  fa: {
    eyebrow: "تجربه شما، داستان شما",
    editorEyebrow: "ویرایشگر شخصی شما",
    designs: "طرح",
    page: "صفحه",
    pages: "صفحه",
    search: "جستجوی بخش‌ها",
  },
};
