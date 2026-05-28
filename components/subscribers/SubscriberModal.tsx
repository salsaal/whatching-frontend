import { useEffect, useState } from "react";

import { Subscriber, SubscriberPayload } from "@/api/types/subscribers.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SubscriberModalProps {
  open: boolean;
  subscriber?: Subscriber | null;
  isSaving: boolean;
  availableTags?: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (payload: SubscriberPayload) => void;
}

export default function SubscriberModal({
  open,
  subscriber,
  isSaving,
  availableTags = [],
  onOpenChange,
  onSave
}: SubscriberModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    setPhoneNumber(subscriber?.phoneNumber || "");
    setFirstName(subscriber?.firstName || "");
    setLastName(subscriber?.lastName || "");
    setSelectedTags(subscriber?.tags || []);
  }, [subscriber, open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    onSave({
      phoneNumber: phoneNumber.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      tags: selectedTags
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {subscriber ? "Edit subscriber" : "Add subscriber"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Phone number</Label>
              <Input
                value={phoneNumber}
                disabled={Boolean(subscriber)}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="919876543210"
                className="mt-2"
              />
            </div>
            <div>
              <Label>First name</Label>
              <Input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Zaki"
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Last name</Label>
              <Input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Afzal"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Tags</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 w-full justify-start font-normal"
                  >
                    {selectedTags.length
                      ? `${selectedTags.length} selected`
                      : "Select tags"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  {availableTags.length ? (
                    availableTags.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={(checked) =>
                          setSelectedTags((current) =>
                            checked
                              ? [...current, tag]
                              : current.filter((item) => item !== tag)
                          )
                        }
                        onSelect={(event) => event.preventDefault()}
                      >
                        {tag}
                      </DropdownMenuCheckboxItem>
                    ))
                  ) : (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      No tags found
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
