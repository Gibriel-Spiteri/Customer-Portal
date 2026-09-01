import { z } from 'zod';

/**
 * The service-case subjects a customer can raise from the portal.
 *
 * These ids are NetSuite's `custevent_svrcjpr_subj_list` list values, and the
 * labels are that list's text verbatim. NetSuite's own user event (case.js,
 * Case_BeforeSubmit) overwrites the case Subject with the selected option's
 * text, so the label a customer picks here is literally the case title the
 * service team triages — keep the two in step.
 *
 * Shared by the client form and the server route so there is exactly one
 * source of truth for what the portal is allowed to file.
 */
export const SERVICE_CASE_SUBJECTS = [
  { id: '1', label: 'Damaged and/or Defective Item(s)' },
  { id: '2', label: 'Missing Item(s)' },
  { id: '3', label: 'Incorrect Items(s)' },
  { id: '4', label: 'Return Authorization Request' },
  { id: '5', label: 'Re-Measure Request' },
  { id: '6', label: 'Replacement Issue(s)' },
] as const;

export type ServiceCaseSubjectId = (typeof SERVICE_CASE_SUBJECTS)[number]['id'];

export const SERVICE_CASE_SUBJECT_IDS = SERVICE_CASE_SUBJECTS.map((s) => s.id) as [
  ServiceCaseSubjectId,
  ...ServiceCaseSubjectId[]
];

export function serviceCaseSubjectLabel(id: string): string | undefined {
  return SERVICE_CASE_SUBJECTS.find((s) => s.id === id)?.label;
}

/**
 * Request body for POST /api/support/tickets. The customer is NOT taken from
 * the body — it comes from the authenticated session — so a caller cannot file
 * a case against someone else's account. The sales order, when supplied, is
 * re-verified server-side against that same customer.
 */
export const createServiceTicketSchema = z.object({
  subjectId: z.enum(SERVICE_CASE_SUBJECT_IDS, {
    errorMap: () => ({ message: 'Please choose an issue type.' }),
  }),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(10000, 'Description must be 10000 characters or fewer'),
  salesOrderId: z.string().regex(/^\d+$/).optional().or(z.literal('')),
});

export type CreateServiceTicketInput = z.infer<typeof createServiceTicketSchema>;
