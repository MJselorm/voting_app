import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle2, ArrowLeft } from "lucide-react";

import { useSubmitOrganizationRequest } from "../hooks/useOrganizations";
import {
  organizationRequestSchema,
  type OrganizationRequestFormValues,
} from "../schemas/organizationSchemas";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Notice } from "../../../components/shared/Notice";

export function RequestOrganizationPage() {
  const navigate = useNavigate();
  const [successResponse, setSuccessResponse] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutateAsync: submitRequest, isPending } = useSubmitOrganizationRequest();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationRequestFormValues>({
    resolver: zodResolver(organizationRequestSchema),
    defaultValues: {
      name: "",
      organization_type: "UNIVERSITY",
      description: "",
      contact_email: "",
      website: "",
      logo_url: "",
      country: "",
      supporting_information: "",
    },
  });

  const onSubmit = async (values: OrganizationRequestFormValues) => {
    setSubmitError(null);
    try {
      const response = await submitRequest({
        name: values.name,
        organization_type: values.organization_type,
        description: values.description || null,
        contact_email: values.contact_email || null,
        website: values.website || null,
        logo_url: values.logo_url || null,
        country: values.country,
        supporting_information: values.supporting_information || null,
      });
      setSuccessResponse(response.name);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit request. Please try again.",
      );
    }
  };

  if (successResponse) {
    return (
      <div className="mx-auto max-w-xl py-12 animate-fade">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Request Submitted for Review
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
            Your request to establish <strong>{successResponse}</strong> has been received. Platform
            Super Administrators will review your details and you can track the status in your requests tab.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/app/organizations/requests")}
            >
              Track Request Status
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSuccessResponse(null);
              }}
            >
              Submit Another Request
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade">
      <Link
        to="/app/organizations"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Organisations
      </Link>

      <PageHeader
        title="Request an Organisation"
        description="Submit an institutional charter or organizational request for verification by Platform Administrators."
      />

      {submitError && (
        <Notice variant="error" className="my-2">
          {submitError}
        </Notice>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Organisation Details</CardTitle>
          <CardDescription>
            Provide official entity credentials. All fields are verified against institutional records.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Organisation Name */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Organisation Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Oxford Student Union"
                error={Boolean(errors.name)}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[11px] text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Type & Country Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Organisation Type <span className="text-destructive">*</span>
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground shadow-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                  {...register("organization_type")}
                >
                  <option value="UNIVERSITY">University</option>
                  <option value="DEPARTMENT">Department / Faculty</option>
                  <option value="COMPANY">Company / Enterprise</option>
                  <option value="ASSOCIATION">Association / Union</option>
                  <option value="CLUB">Student Club / Society</option>
                  <option value="OTHER">Other Institution</option>
                </select>
                {errors.organization_type && (
                  <p className="text-[11px] text-destructive">
                    {errors.organization_type.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Country <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g. United Kingdom"
                  error={Boolean(errors.country)}
                  {...register("country")}
                />
                {errors.country && (
                  <p className="text-[11px] text-destructive">{errors.country.message}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Description / Mission Statement
              </label>
              <textarea
                rows={3}
                placeholder="Brief summary of the organization, student body, or department..."
                className="w-full rounded-md border border-input bg-card p-3 text-xs text-foreground shadow-subtle placeholder:text-muted-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-[11px] text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Contact Email & Website */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Official Contact Email
                </label>
                <Input
                  type="email"
                  placeholder="governance@oxford.ac.uk"
                  error={Boolean(errors.contact_email)}
                  {...register("contact_email")}
                />
                {errors.contact_email && (
                  <p className="text-[11px] text-destructive">
                    {errors.contact_email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Official Website
                </label>
                <Input
                  placeholder="https://oxford.ac.uk"
                  error={Boolean(errors.website)}
                  {...register("website")}
                />
                {errors.website && (
                  <p className="text-[11px] text-destructive">{errors.website.message}</p>
                )}
              </div>
            </div>

            {/* Logo URL */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Public Logo URL
              </label>
              <Input
                placeholder="https://example.com/logo.png"
                error={Boolean(errors.logo_url)}
                {...register("logo_url")}
              />
              {errors.logo_url && (
                <p className="text-[11px] text-destructive">{errors.logo_url.message}</p>
              )}
            </div>

            {/* Supporting Information for Reviewers */}
            <div className="space-y-1 pt-2">
              <label className="text-xs font-medium text-foreground">
                Supporting Information for Administrators
              </label>
              <textarea
                rows={3}
                placeholder="Provide charter references, institutional registry numbers, or role justifications..."
                className="w-full rounded-md border border-input bg-card p-3 text-xs text-foreground shadow-subtle placeholder:text-muted-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary"
                {...register("supporting_information")}
              />
              {errors.supporting_information && (
                <p className="text-[11px] text-destructive">
                  {errors.supporting_information.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
              <Link to="/app/organizations">
                <Button variant="ghost" size="sm" type="button">
                  Cancel
                </Button>
              </Link>
              <Button size="sm" type="submit" disabled={isPending}>
                {isPending ? "Submitting Request…" : "Submit Request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
