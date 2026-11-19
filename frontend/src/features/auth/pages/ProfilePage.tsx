import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Notice } from "../../../components/shared/Notice";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";
import { getAuthErrorMessage } from "../lib/authErrors";
import { FormField } from "../components/FormField";
import { profileSchema, type ProfileFormValues } from "../schemas/authSchemas";

export function ProfilePage() {
  const { user, updateProfile, deleteAccount } = useAuth();
  const { data: profile, isLoading, error, refetch } = useUserProfile();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const hasPasswordProvider = Boolean(
    user?.providerData.some((provider) => provider.providerId === "password"),
  );
  const hasSupportedReauthentication = Boolean(
    user?.providerData.some((provider) =>
      ["password", "google.com"].includes(provider.providerId),
    ),
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "" },
  });

  useEffect(() => {
    if (profile) reset({ fullName: profile.full_name });
  }, [profile, reset]);

  const save = handleSubmit(async ({ fullName }) => {
    setSaveMessage("");
    setSaveError("");
    try {
      await updateProfile(fullName);
      setEditing(false);
      setSaveMessage("Your profile has been updated.");
    } catch (cause) {
      setSaveError(getAuthErrorMessage(cause));
    }
  });

  const closeDeleteDialog = (open: boolean) => {
    if (deleting) return;
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteConfirmation("");
      setDeletePassword("");
      setDeleteError("");
    }
  };

  const submitDeletion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (deleteConfirmation !== "DELETE" || !hasSupportedReauthentication) return;

    setDeleteError("");
    setDeleting(true);
    try {
      await deleteAccount(hasPasswordProvider ? deletePassword : undefined);
      navigate("/", { replace: true });
    } catch (cause) {
      setDeleteError(getAuthErrorMessage(cause));
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" role="status">Loading your profile…</p>;
  }
  if (!profile) {
    return (
      <Notice>
        {error instanceof Error ? error.message : "Your profile could not be loaded."}
        {" "}
        <button className="font-bold underline" onClick={() => void refetch()} type="button">
          Try again
        </button>
      </Notice>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your personal information and account settings."
        breadcrumbs={[{ label: "Workspace", href: "/app" }, { label: "Profile" }]}
        actions={!editing ? (
          <Button variant="outline" onClick={() => {
            reset({ fullName: profile.full_name });
            setEditing(true);
            setSaveMessage("");
            setSaveError("");
          }} type="button">
            Edit profile
          </Button>
        ) : undefined}
      />

      {saveMessage && <Notice variant="success">{saveMessage}</Notice>}
      {saveError && <Notice>{saveError}</Notice>}

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={save}>
            <FormField
              label="Full name"
              error={editing ? errors.fullName?.message : undefined}
              inputProps={{
                autoComplete: "name",
                maxLength: 120,
                disabled: !editing,
                ...register("fullName"),
              }}
            />
            <FormField
              label="Email address"
              hint="Email changes are managed through Firebase and are not editable here."
              inputProps={{ value: profile.email, readOnly: true }}
            />
            {editing && (
              <div className="flex flex-wrap gap-2">
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={() => {
                    reset({ fullName: profile.full_name });
                    setEditing(false);
                    setSaveError("");
                  }}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Email verification</span>
            <strong className="text-sm">{profile.email_verified ? "Verified" : "Not verified"}</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Account created</span>
            <strong className="text-sm">{new Date(profile.created_at).toLocaleDateString()}</strong>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Account status</span>
            <strong className="text-sm">{profile.is_active ? "Active" : "Inactive"}</strong>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="mb-1 text-sm font-semibold">Delete your account</p>
            <p className="m-0 text-xs leading-5 text-muted-foreground">
              This permanently removes your UniVote profile and Firebase sign-in.
              This action cannot be undone.
            </p>
          </div>
          <Button
            onClick={() => closeDeleteDialog(true)}
            type="button"
            variant="destructive"
          >
            Delete account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent
          aria-describedby="delete-account-description"
          aria-labelledby="delete-account-title"
        >
          <DialogHeader>
            <DialogTitle id="delete-account-title">Delete your account permanently?</DialogTitle>
            <DialogDescription id="delete-account-description">
              Your UniVote profile and Firebase account will be deleted. There is no undo.
              Reauthenticate to confirm this request.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitDeletion}>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold" htmlFor="delete-confirmation">
                Type DELETE to continue
              </label>
              <Input
                autoComplete="off"
                id="delete-confirmation"
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                value={deleteConfirmation}
              />
            </div>
            {hasPasswordProvider ? (
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold" htmlFor="delete-password">
                  Current password
                </label>
                <Input
                  autoComplete="current-password"
                  id="delete-password"
                  onChange={(event) => setDeletePassword(event.target.value)}
                  type="password"
                  value={deletePassword}
                />
              </div>
            ) : hasSupportedReauthentication ? (
              <p className="m-0 text-xs text-muted-foreground">
                Google will ask you to sign in again before deletion.
              </p>
            ) : (
              <Notice>
                This sign-in method cannot be reauthenticated here. Contact support before deleting your account.
              </Notice>
            )}
            {deleteError && <Notice>{deleteError}</Notice>}
            <DialogFooter>
              <Button
                disabled={deleting}
                onClick={() => closeDeleteDialog(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  deleting ||
                  deleteConfirmation !== "DELETE" ||
                  (hasPasswordProvider && !deletePassword) ||
                  !hasSupportedReauthentication
                }
                type="submit"
                variant="destructive"
              >
                {deleting ? "Deleting…" : "Reauthenticate and delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
