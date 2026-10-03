'use client';

import type { CsvImportResult } from '@apply-tracker/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { FormError } from '@/components/form/form-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { applicationsApi } from '../../api';
import { applicationKeys } from '../../hooks';

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const inputId = useId();
  const queryClient = useQueryClient();

  const importCsv = useMutation({
    mutationFn: applicationsApi.importCsv,
    onSuccess: async (data) => {
      setResult(data);
      if (data.created > 0) {
        toast.success(`Imported ${data.created} application${data.created === 1 ? '' : 's'}`);
        await queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      }
    },
  });

  const reset = () => {
    setFile(null);
    setResult(null);
    importCsv.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload aria-hidden />
        Import CSV
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import applications</DialogTitle>
          <DialogDescription>
            Upload a CSV with at least <strong>Company</strong> and <strong>Role</strong> columns.
            Optional columns: Status, Priority, Location, Work mode, Source, Salary min, Salary max,
            Currency, Applied on, Job URL, Tags. An export from ApplyTracker can be imported as-is.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              Created <strong>{result.created}</strong> application{result.created === 1 ? '' : 's'}
              .
            </p>
            {result.errors.length > 0 && (
              <div>
                <p className="font-medium">{result.errors.length} row(s) were skipped:</p>
                <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-muted-foreground">
                  {result.errors.map((error) => (
                    <li key={error.row}>
                      Line {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label
              htmlFor={inputId}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm hover:bg-muted/50"
            >
              <FileUp className="size-6 text-muted-foreground" aria-hidden />
              {file ? (
                <span className="font-medium">{file.name}</span>
              ) : (
                <span>Choose a .csv file (max 1 MB)</span>
              )}
              <input
                id={inputId}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <FormError message={importCsv.error?.message} />
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={reset} variant="outline">
              Import another file
            </Button>
          ) : (
            <Button
              onClick={() => file && importCsv.mutate(file)}
              disabled={!file || importCsv.isPending}
            >
              {importCsv.isPending ? 'Importing…' : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
