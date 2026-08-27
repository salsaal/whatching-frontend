import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ManualConnectDialogProps {
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: {
    wabaId: string;
    phoneNumberId: string;
    accessToken: string;
    coexistenceEnabled: boolean;
  }) => void;
}

export default function ManualConnectDialog({
  open,
  isSaving,
  onOpenChange,
  onSave
}: ManualConnectDialogProps) {
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [coexistenceEnabled, setCoexistenceEnabled] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({
      wabaId: wabaId.trim(),
      phoneNumberId: phoneNumberId.trim(),
      accessToken: accessToken.trim(),
      coexistenceEnabled
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect a WhatsApp number manually</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use this only if Embedded Signup isn&apos;t available. You&apos;ll
            need the WABA ID, phone number ID, and a Meta system-user access
            token with permission for this WhatsApp Business Account.
          </p>

          <div>
            <Label>WABA ID</Label>
            <Input
              value={wabaId}
              onChange={(event) => setWabaId(event.target.value)}
              placeholder="1234567890"
              required
              className="mt-2"
            />
          </div>

          <div>
            <Label>Phone number ID</Label>
            <Input
              value={phoneNumberId}
              onChange={(event) => setPhoneNumberId(event.target.value)}
              placeholder="1234567890"
              required
              className="mt-2"
            />
          </div>

          <div>
            <Label>Access token</Label>
            <Textarea
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="EAAG..."
              required
              className="mt-2 max-h-32"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={coexistenceEnabled}
              onCheckedChange={(checked) =>
                setCoexistenceEnabled(Boolean(checked))
              }
            />
            This number uses WhatsApp Business App coexistence
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
