import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Eye, FileText, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/formatters';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface ApprovalRequest {
  id: string;
  company_id: string;
  entity_type: string;
  entity_id: string;
  document_number: string;
  requested_by: string | null;
  requested_at: string;
  amount: number;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
}

const approvalBadgeClass = (status: string) => {
  switch (status) {
    case 'approved':
      return 'bg-success/10 text-success border-success/20';
    case 'rejected':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'cancelled':
      return 'bg-muted text-muted-foreground border-border line-through';
    default:
      return 'bg-warning/10 text-warning border-warning/20';
  }
};

const entityLabel = (entityType: string) => {
  switch (entityType) {
    case 'purchase_order':
      return 'Purchase Order';
    case 'bill':
      return 'Bill';
    case 'payment':
      return 'Payment';
    default:
      return entityType;
  }
};

const entityLink = (entityType: string) => {
  switch (entityType) {
    case 'purchase_order':
      return '/purchases/orders';
    case 'bill':
      return '/purchases/bills';
    case 'payment':
      return '/purchases/payments';
    default:
      return '/approvals';
  }
};

export default function ApprovalCenter() {
  const { selectedCompany } = useCompany();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | ApprovalStatus>('pending');
  const [entityFilter, setEntityFilter] = useState<'all' | string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [actionMode, setActionMode] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');

  const canApprove = isAdmin || isSuperAdmin;

  const fetchRequests = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('requested_at', { ascending: false });

    if (error) {
      toast.error('Gagal memuat approval: ' + error.message);
    } else {
      setRequests((data || []) as ApprovalRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedCompany?.id]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const statusMatch = statusFilter === 'all' || request.status === statusFilter;
      const entityMatch = entityFilter === 'all' || request.entity_type === entityFilter;
      return statusMatch && entityMatch;
    });
  }, [requests, statusFilter, entityFilter]);

  const stats = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
    amountPending: requests.filter((r) => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount || 0), 0),
  }), [requests]);

  const openActionDialog = (request: ApprovalRequest, mode: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionMode(mode);
    setNotes('');
  };

  const closeActionDialog = () => {
    setSelectedRequest(null);
    setActionMode(null);
    setNotes('');
  };

  const processRequest = async () => {
    if (!selectedRequest || !actionMode) return;
    if (actionMode === 'reject' && !notes.trim()) {
      toast.error('Alasan reject wajib diisi');
      return;
    }

    setProcessingId(selectedRequest.id);
    const { error } = actionMode === 'approve'
      ? await supabase.rpc('approve_request', { _request_id: selectedRequest.id, _notes: notes.trim() || undefined })
      : await supabase.rpc('reject_request', { _request_id: selectedRequest.id, _reason: notes.trim() });

    if (error) {
      toast.error(`Gagal ${actionMode === 'approve' ? 'approve' : 'reject'}: ${error.message}`);
    } else {
      toast.success(`Dokumen ${selectedRequest.document_number} berhasil ${actionMode === 'approve' ? 'disetujui' : 'ditolak'}`);
      closeActionDialog();
      fetchRequests();
    }
    setProcessingId(null);
  };

  if (!canApprove) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <ShieldCheck className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">Approval Center khusus Admin</h2>
        <p className="max-w-md text-sm text-muted-foreground">Hanya admin/superadmin yang bisa approve atau reject dokumen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Approval Center</h1>
          <p className="mt-1 text-muted-foreground">Approve PO, Bill, dan Payment sebelum dokumen diproses/jurnal dibuat.</p>
        </div>
        <Button variant="outline" onClick={fetchRequests} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-warning">{stats.pending}</p>
            </div>
            <Clock className="h-10 w-10 text-warning/30" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Nilai Pending</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.amountPending)}</p>
            </div>
            <FileText className="h-10 w-10 text-primary/30" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold text-success">{stats.approved}</p>
            </div>
            <CheckCircle2 className="h-10 w-10 text-success/30" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
            </div>
            <XCircle className="h-10 w-10 text-destructive/30" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Tipe Dokumen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Dokumen</SelectItem>
            <SelectItem value="purchase_order">Purchase Order</SelectItem>
            <SelectItem value="bill">Bill</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Approval</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Memuat approval...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Tidak ada approval untuk filter ini.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dokumen</th>
                    <th>Tipe</th>
                    <th>Tanggal Request</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                    <th>Catatan</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="font-mono font-medium">{request.document_number}</td>
                      <td>{entityLabel(request.entity_type)}</td>
                      <td>{formatDate(request.requested_at)}</td>
                      <td>
                        <span className={cn('badge-status capitalize', approvalBadgeClass(request.status))}>{request.status}</span>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(Number(request.amount || 0))}</td>
                      <td className="max-w-xs truncate text-muted-foreground">{request.rejection_reason || request.notes || '-'}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={entityLink(request.entity_type)}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {request.status === 'pending' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openActionDialog(request, 'reject')} disabled={processingId === request.id}>
                                Reject
                              </Button>
                              <Button size="sm" onClick={() => openActionDialog(request, 'approve')} disabled={processingId === request.id}>
                                Approve
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest && !!actionMode} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionMode === 'approve' ? 'Approve Dokumen' : 'Reject Dokumen'}</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Dokumen</span>
                  <span className="font-mono font-medium">{selectedRequest.document_number}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Tipe</span>
                  <span>{entityLabel(selectedRequest.entity_type)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">{formatCurrency(Number(selectedRequest.amount || 0))}</span>
                </div>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={actionMode === 'approve' ? 'Catatan approval (opsional)' : 'Alasan reject (wajib)'}
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog}>Batal</Button>
            <Button
              variant={actionMode === 'reject' ? 'destructive' : 'default'}
              onClick={processRequest}
              disabled={!selectedRequest || processingId === selectedRequest?.id}
            >
              {actionMode === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}