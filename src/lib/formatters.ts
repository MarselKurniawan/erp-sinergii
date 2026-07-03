export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat('id-ID').format(value);
};

export const formatCompactCurrency = (value: number) => {
  if (value >= 1000000000) {
    return `Rp ${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `Rp ${(value / 1000000).toFixed(1)}M`;
  }
  return formatCurrency(value);
};

export const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateInput = (date: string) => {
  return new Date(date).toISOString().split('T')[0];
};

export const getStatusBadgeClass = (status: string) => {
  const statusMap: Record<string, string> = {
    draft: 'badge-draft',
    confirmed: 'badge-confirmed',
    sent: 'badge-confirmed',
    invoiced: 'badge-confirmed',
    paid: 'badge-paid',
    partial: 'badge-partial',
    overdue: 'badge-overdue',
    cancelled: 'badge-cancelled',
    pending: 'bg-warning/10 text-warning border-warning/20',
    approved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  return statusMap[status] || 'badge-draft';
};
