import React from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
}

export const ComingSoon: React.FC<Props> = ({ title, description }) => {
  const location = useLocation();
  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto mt-12">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Construction className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{title || 'Coming Soon'}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {description || 'Halaman ini sedang dalam pembangunan dan akan segera tersedia.'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Route: <code className="px-2 py-1 rounded bg-muted">{location.pathname}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoon;