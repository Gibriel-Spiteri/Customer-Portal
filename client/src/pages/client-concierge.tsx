import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarCheck,
  Store,
  User,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

interface SalesRep {
  id: string;
  name: string;
  email: string | null;
}

interface StoreWithReps {
  store: string;
  salespeople: SalesRep[];
}

const conciergeSchema = z.object({
  storeName: z.string().min(1, "Please select a store"),
  salesRepId: z.string().min(1, "Please select a salesperson"),
  clientName: z.string().min(1, "Please enter your client's name").max(200),
  clientEmail: z
    .string()
    .email("Please enter a valid email")
    .max(255)
    .optional()
    .or(z.literal("")),
  clientPhone: z.string().max(50).optional(),
  preferredDate: z.string().min(1, "Please choose a preferred date"),
  preferredTime: z.enum(["Morning", "Afternoon"]).optional(),
  projectDetails: z.string().max(5000).optional(),
});

type ConciergeForm = z.infer<typeof conciergeSchema>;

export default function ClientConcierge() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState<{ message: string; savedOnly: boolean } | null>(null);

  const { data, isLoading: loadingReps } = useQuery<{ stores: StoreWithReps[] }>({
    queryKey: ["/api/quick-quote/salespeople"],
    enabled: !!token,
    staleTime: 10 * 60 * 1000,
  });

  const form = useForm<ConciergeForm>({
    resolver: zodResolver(conciergeSchema),
    defaultValues: {
      storeName: "",
      salesRepId: "",
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      preferredDate: "",
      projectDetails: "",
    },
  });

  const selectedStore = form.watch("storeName");
  const reps =
    data?.stores.find((s) => s.store === selectedStore)?.salespeople || [];

  const submitMutation = useMutation({
    mutationFn: async (values: ConciergeForm) => {
      const response = await fetch("/api/client-concierge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });
      const body = await response.json();
      // 502 = request saved but salesperson not notified; treat as partial
      // success (don't invite a duplicate resubmission).
      if (response.status === 502) return { ...body, savedOnly: true };
      if (!response.ok) throw new Error(body.message || "Failed to send request");
      return { ...body, savedOnly: false };
    },
    onSuccess: (body) => {
      setSubmitted({ message: body.message, savedOnly: body.savedOnly });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Could not send request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return <div>Please log in to use Client Concierge</div>;
  }

  // Earliest selectable date: tomorrow
  const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <MobileLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-netsuite-blue" />
          Client Concierge
        </h1>
        <p className="mt-1 text-gray-600">
          Request a showroom appointment for your client. We'll guide their
          design and product selections, show only retail pricing, and email
          your profit-protected estimates.
        </p>
      </div>

      {submitted ? (
        <Card>
          <CardContent className="py-12 text-center">
            {submitted.savedOnly ? (
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            ) : (
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            )}
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {submitted.savedOnly ? "Request saved" : "Request sent!"}
            </h2>
            <p className="text-gray-600 mb-6">{submitted.message}</p>
            <Button onClick={() => setSubmitted(null)} variant="outline">
              Send another request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Request a showroom appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((v) => submitMutation.mutate(v))}
              className="space-y-6"
            >
              {/* Store */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-gray-500" />
                  Showroom
                </Label>
                {loadingReps ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Controller
                    control={form.control}
                    name="storeName"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          form.setValue("salesRepId", "");
                        }}
                      >
                        <SelectTrigger data-testid="select-store">
                          <SelectValue placeholder="Choose a showroom" />
                        </SelectTrigger>
                        <SelectContent>
                          {data?.stores.map((s) => (
                            <SelectItem key={s.store} value={s.store}>
                              {s.store}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
                {form.formState.errors.storeName && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.storeName.message}
                  </p>
                )}
              </div>

              {/* Salesperson */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  Salesperson
                </Label>
                <Controller
                  control={form.control}
                  name="salesRepId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedStore}
                    >
                      <SelectTrigger data-testid="select-salesperson">
                        <SelectValue
                          placeholder={
                            selectedStore
                              ? "Choose a salesperson"
                              : "Choose a showroom first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {reps.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.salesRepId && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.salesRepId.message}
                  </p>
                )}
              </div>

              {/* Client info */}
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  placeholder="Who is the appointment for?"
                  data-testid="input-client-name"
                  {...form.register("clientName")}
                />
                {form.formState.errors.clientName && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.clientName.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Client Email (optional)</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="client@email.com"
                    data-testid="input-client-email"
                    {...form.register("clientEmail")}
                  />
                  {form.formState.errors.clientEmail && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.clientEmail.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Client Phone (optional)</Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    placeholder="(555) 555-5555"
                    data-testid="input-client-phone"
                    {...form.register("clientPhone")}
                  />
                </div>
              </div>

              {/* Date / time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredDate">Preferred Date</Label>
                  <Input
                    id="preferredDate"
                    type="date"
                    min={minDate}
                    data-testid="input-preferred-date"
                    {...form.register("preferredDate")}
                  />
                  {form.formState.errors.preferredDate && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.preferredDate.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Preferred Time (optional)</Label>
                  <Controller
                    control={form.control}
                    name="preferredTime"
                    render={({ field }) => (
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger data-testid="select-preferred-time">
                          <SelectValue placeholder="Morning or afternoon" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Morning">Morning</SelectItem>
                          <SelectItem value="Afternoon">Afternoon</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {/* Project details */}
              <div className="space-y-2">
                <Label htmlFor="projectDetails">
                  Project Details (optional)
                </Label>
                <Textarea
                  id="projectDetails"
                  rows={4}
                  placeholder="What is the client shopping for? Style preferences, budget guidance, anything the salesperson should know."
                  data-testid="input-project-details"
                  {...form.register("projectDetails")}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
                data-testid="button-submit"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Request Appointment"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </MobileLayout>
  );
}
