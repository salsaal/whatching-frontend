import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

/** A yes/no question before something that can't be undone. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  action,
  cancel = "Keep it",
  isPending,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: React.ReactNode;
  action: string;
  cancel?: string;
  isPending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancel}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
