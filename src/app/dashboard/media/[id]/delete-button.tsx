'use client'

import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { deleteContent } from "../actions"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function DeleteButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteContent(id)
    } catch (e) {
      setIsDeleting(false)
      alert("Failed to delete content")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>
        <Trash2 className="mr-2 h-4 w-4" /> Delete Content
      </DialogTrigger>
      <DialogContent className="glass-card sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Content?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your content and remove its data from our servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
