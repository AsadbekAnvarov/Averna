/**
 * Messages of the part-boundary block ("Qismlar chegaralari") and its API, in
 * Uzbek (Latin): the Audio_Manager is an admin/teacher tool. oʻ/gʻ use U+02BB,
 * the tutuq belgisi uses U+02BC. "Part N" stays in English (as in the exam).
 * Pure: shared by the route and the client component.
 */

export type SegmentMessageKey =
  | "empty"
  | "format"
  | "partition"
  | "min-length"
  | "evidence"
  | "conflict"
  | "network"
  | "recording"
  | "saved"
  | "unauthorized"
  | "forbidden"
  | "invalid"
  | "not-found"
  | "server";

/** `part` is the part number the message is about (1–4). */
export function segmentMessage(key: SegmentMessageKey, part?: number): string {
  const n = part ?? 1;
  switch (key) {
    case "empty":
      return `Chegara boʻsh: Part ${n} va Part ${n + 1} orasidagi vaqtni kiriting.`;
    case "format":
      return "Vaqt notoʻgʻri: mm:ss.d koʻrinishida kiriting (masalan, 06:42.3).";
    case "partition":
      return `Chegaralar notoʻgʻri: Part ${n} yozuvni boʻshliqsiz va ustma-ust tushmasdan qoplashi kerak.`;
    case "min-length":
      return `Chegaralar notoʻgʻri: har bir qism kamida 2 daqiqa boʻlishi kerak (Part ${n}).`;
    case "evidence":
      return `Chegaralar notoʻgʻri: Part ${n} javob oynalari shu qism ichida boʻlishi kerak.`;
    case "conflict":
      return "Chegaralarni boshqa foydalanuvchi allaqachon oʻzgartirgan. Sahifani yangilang.";
    case "network":
      return "Chegaralarni saqlab boʻlmadi. Internet aloqasini tekshirib, qayta urinib koʻring.";
    case "recording":
      return "Yozuvni oʻqib boʻlmadi: hosting faylni brauzerga bermayapti yoki fayl oʻzgargan.";
    case "saved":
      return "Chegaralar saqlandi va tasdiqlandi.";
    case "unauthorized":
      return "Tizimga kiring.";
    case "forbidden":
      return "Faqat oʻqituvchi va administratorlar uchun.";
    case "invalid":
      return "Soʻrov maʼlumotlari notoʻgʻri.";
    case "not-found":
      return "Test topilmadi yoki unda toʻliq yozuv yoʻq.";
    case "server":
      return "Chegaralarni saqlab boʻlmadi — birozdan keyin qayta urinib koʻring.";
  }
}
