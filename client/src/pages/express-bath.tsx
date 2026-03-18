import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { MobileLayout } from '@/components/layout/mobile-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  AlertCircle,
  RefreshCw,
  PackageCheck,
  PackageX,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';

interface ExpressBathItem {
  internalid: string;
  itemnumber: string;
  displayname: string;
  description: string | null;
  itemtype: string;
  quantityonhand: string;
  quantityavailable: string;
  quantitycommitted: string;
  quantityonorder: string;
  quantitybackordered: string;
  baseprice: string | null;
  unittype: string | null;
  lastmodifieddate: string | null;
}

interface ExpressBathResponse {
  success: boolean;
  items: ExpressBathItem[];
  count: number;
  hasMore: boolean;
  totalResults?: number;
}

function getStockBadge(quantityAvailable: number) {
  if (quantityAvailable > 10) {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">In Stock</Badge>;
  } else if (quantityAvailable > 0) {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Low Stock</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Out of Stock</Badge>;
}

function ExpressBathContent() {
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ExpressBathResponse>({
    queryKey: ['/api/express-bath/items'],
    enabled: !!token,
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm.trim()) return data.items;
    const term = searchTerm.toLowerCase();
    return data.items.filter(item =>
      (item.itemnumber || '').toLowerCase().includes(term) ||
      (item.displayname || '').toLowerCase().includes(term) ||
      (item.description || '').toLowerCase().includes(term)
    );
  }, [data?.items, searchTerm]);

  const totalOnHand = useMemo(() => {
    if (!data?.items) return 0;
    return data.items.reduce((sum, item) => sum + parseFloat(item.quantityonhand || '0'), 0);
  }, [data?.items]);

  const totalAvailable = useMemo(() => {
    if (!data?.items) return 0;
    return data.items.reduce((sum, item) => sum + parseFloat(item.quantityavailable || '0'), 0);
  }, [data?.items]);

  const outOfStockCount = useMemo(() => {
    if (!data?.items) return 0;
    return data.items.filter(item => parseFloat(item.quantityavailable || '0') <= 0).length;
  }, [data?.items]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load Express Bath items: {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Express Bath</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.items?.length || 0} items
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Items</p>
                <p className="text-xl font-bold">{data?.items?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <PackageCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Available</p>
                <p className="text-xl font-bold">{totalAvailable.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <PackageX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Out of Stock</p>
                <p className="text-xl font-bold">{outOfStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Items & Inventory</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Package className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">
                {searchTerm ? 'No matching items found' : 'No Express Bath items found'}
              </p>
              <p className="text-sm mt-1">
                {searchTerm ? 'Try adjusting your search term' : 'Items with Express Bath checked will appear here'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Committed</TableHead>
                    <TableHead className="text-right">On Order</TableHead>
                    <TableHead className="text-right">Back Ordered</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const available = parseFloat(item.quantityavailable || '0');
                    return (
                      <TableRow key={item.internalid}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{item.displayname || item.itemnumber}</p>
                            {item.displayname && item.itemnumber && (
                              <p className="text-xs text-gray-500">{item.itemnumber}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {parseFloat(item.quantityonhand || '0').toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {available.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {parseFloat(item.quantitycommitted || '0').toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {parseFloat(item.quantityonorder || '0').toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {parseFloat(item.quantitybackordered || '0').toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStockBadge(available)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ExpressBath() {
  return (
    <MobileLayout title="Express Bath">
      <ExpressBathContent />
    </MobileLayout>
  );
}
