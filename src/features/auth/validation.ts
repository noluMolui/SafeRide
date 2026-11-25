import { z } from "zod";

export const passwordMessage =
  "Password must be at least 8 characters and include a letter and a number";

export function normalizeSouthAfricanPhone(value: string) {
  const phone = value.replace(/[\s-]/g, "");
  return phone.startsWith("0") ? `+27${phone.slice(1)}` : phone;
}

export const signupSchema = z.object({
  role: z.enum(["parent", "driver"]),
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .refine(
      (value) => /^(?:0|\+27)[6-8]\d{8}$/.test(value.replace(/[\s-]/g, "")),
      "Enter a valid South African mobile number",
    ),
  password: z
    .string()
    .min(8, passwordMessage)
    .regex(/[a-z]/i, passwordMessage)
    .regex(/[0-9]/, passwordMessage),
  consent: z.literal(true, {
    errorMap: () => ({ message: "You must accept the privacy notice to continue" }),
  }),
});

export const southAfricaToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const complianceSchema = z.object({
  pdp: z.string().trim().regex(/^[a-z0-9]{4,20}$/i, "Enter 4–20 letters or numbers"),
  pdpExpiry: z.string().refine(
    (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= southAfricaToday(),
    "Your PDP has expired or the date is missing. Enter a valid date.",
  ),
  suburbs: z.array(z.string().trim().min(2).max(60)).min(1, "Add at least one suburb").max(10),
  registration: z
    .string()
    .transform((value) => value.toUpperCase().replace(/[\s-]/g, ""))
    .refine((value) => /^[A-Z0-9]{4,10}$/.test(value), "Enter a valid registration number"),
  model: z.string().trim().min(1, "Enter the vehicle make and model"),
  seats: z.number().int().min(4, "Capacity must be between 4 and 35").max(35, "Capacity must be between 4 and 35"),
  roadworthyExpiry: z.string().refine(
    (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= southAfricaToday(),
    "Enter a current roadworthy expiry date",
  ),
});

export function fileError(file: File): string | undefined {
  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
    return "Choose a JPEG, PNG or PDF file.";
  }
  if (file.size > 5 * 1024 * 1024) return "The file must be 5 MB or smaller.";
}
