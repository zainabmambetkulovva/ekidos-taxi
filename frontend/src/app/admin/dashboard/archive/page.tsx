'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, RotateCcw, Trash2, User, Car, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

export default function ArchivePage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['archived-drivers'],
    queryFn: async () => {
      const { data } = await api.get('/drivers/archived/list');
      return data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/drivers/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-drivers'] });
      toast.success('Водитель калыбына келтирилди');
    },
    onError: () => toast.error('Ката'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/drivers/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-drivers'] });
      toast.success('Водитель биротоло өчүрүлдү');
    },
    onError: () => toast.error('Ката'),
  });

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const drivers = data?.drivers || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Archive className="w-6 h-6 text-orange-400" />
          Архив
        </h1>
        <p className="text-muted-foreground text-sm">
          Өчүрүлгөн водителдер. Калыбына келтирүү же биротоло өчүрүү мүмкүн.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Archive className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Архив бош</h3>
            <p className="text-sm text-muted-foreground/60 mt-1">Өчүрүлгөн водителдер жок</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {drivers.map((driver: any) => (
            <Card key={driver.id} className="hover:border-orange-500/20 transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">
                          {driver.firstName} {driver.lastName}
                        </p>
                        {driver.callsign && (
                          <Badge variant="secondary" className="text-xs">
                            #{driver.callsign}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {driver.phone}
                        </span>
                        {driver.vehicle && (
                          <span className="flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {driver.vehicle.brand} {driver.vehicle.plateNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Архивделди: {formatDate(driver.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-green-400 border-green-500/30 hover:bg-green-500/10"
                      onClick={() => restoreMutation.mutate(driver.id)}
                      disabled={restoreMutation.isPending}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Калыбына
                    </Button>

                    {confirmDelete === driver.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => { deleteMutation.mutate(driver.id); setConfirmDelete(null); }}
                          disabled={deleteMutation.isPending}
                        >
                          Ооба
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Жок
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:bg-red-500/10"
                        onClick={() => setConfirmDelete(driver.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
