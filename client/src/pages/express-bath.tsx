import { MobileLayout } from '@/components/layout/mobile-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  PackageCheck,
  PackageX,
  Search,
  RefreshCw,
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

const DUMMY_ITEMS: ExpressBathItem[] = [
  {
    internalid: '10001',
    itemnumber: 'EB-VAN-36WHT',
    displayname: '36" Single Sink Vanity - White',
    description: 'Modern single sink bathroom vanity with soft-close drawers',
    itemtype: 'InvtPart',
    quantityonhand: '45',
    quantityavailable: '32',
    quantitycommitted: '13',
    quantityonorder: '20',
    quantitybackordered: '0',
    baseprice: '849.99',
    unittype: 'Each',
    lastmodifieddate: '03/15/2026',
  },
  {
    internalid: '10002',
    itemnumber: 'EB-VAN-48GRY',
    displayname: '48" Double Sink Vanity - Gray',
    description: 'Contemporary double sink vanity with quartz countertop',
    itemtype: 'InvtPart',
    quantityonhand: '18',
    quantityavailable: '12',
    quantitycommitted: '6',
    quantityonorder: '15',
    quantitybackordered: '3',
    baseprice: '1299.99',
    unittype: 'Each',
    lastmodifieddate: '03/14/2026',
  },
  {
    internalid: '10003',
    itemnumber: 'EB-FAU-CHRM',
    displayname: 'Single Handle Faucet - Chrome',
    description: 'Widespread bathroom faucet with pop-up drain',
    itemtype: 'InvtPart',
    quantityonhand: '156',
    quantityavailable: '140',
    quantitycommitted: '16',
    quantityonorder: '50',
    quantitybackordered: '0',
    baseprice: '129.99',
    unittype: 'Each',
    lastmodifieddate: '03/16/2026',
  },
  {
    internalid: '10004',
    itemnumber: 'EB-ACC-TBRNG',
    displayname: 'Towel Bar Ring Set - Matte Black',
    description: '4-piece bathroom accessory set',
    itemtype: 'InvtPart',
    quantityonhand: '0',
    quantityavailable: '0',
    quantitycommitted: '0',
    quantityonorder: '40',
    quantitybackordered: '15',
    baseprice: '79.99',
    unittype: 'Set',
    lastmodifieddate: '03/07/2026',
  },
];

function getStockBadge(quantityAvailable: number) {
  if (quantityAvailable > 10) {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">In Stock</Badge>;
  } else if (quantityAvailable > 0) {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Low Stock</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Out of Stock</Badge>;
}

function ExpressBathContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const items = DUMMY_ITEMS;

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      (item.itemnumber || '').toLowerCase().includes(term) ||
      (item.displayname || '').toLowerCase().includes(term) ||
      (item.description || '').toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  const totalAvailable = useMemo(() => {
    return items.reduce((sum, item) => sum + parseFloat(item.quantityavailable || '0'), 0);
  }, [items]);

  const outOfStockCount = useMemo(() => {
    return items.filter(item => parseFloat(item.quantityavailable || '0') <= 0).length;
  }, [items]);

  return (
    <div className="p-4 md:p-6 space-y-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Express Bath</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} items
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {}}>
          <RefreshCw className="h-4 w-4 mr-2" />
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
                <p className="text-xl font-bold">{items.length}</p>
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
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Package className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No matching items found</p>
              <p className="text-sm mt-1">Try adjusting your search term</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const available = parseFloat(item.quantityavailable || '0');
                return (
                  <div key={item.internalid} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.displayname || item.itemnumber}</p>
                        <p className="text-xs text-gray-500">{item.itemnumber}</p>
                        {item.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          {item.baseprice ? `$${parseFloat(item.baseprice).toFixed(2)}` : '-'}
                        </span>
                        {getStockBadge(available)}
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="text-gray-400">On Hand</span>
                        <p className="font-mono font-medium">{parseFloat(item.quantityonhand || '0').toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Available</span>
                        <p className="font-mono font-medium">{available.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Committed</span>
                        <p className="font-mono font-medium">{parseFloat(item.quantitycommitted || '0').toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">On Order</span>
                        <p className="font-mono font-medium">{parseFloat(item.quantityonorder || '0').toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Backordered</span>
                        <p className="font-mono font-medium">{parseFloat(item.quantitybackordered || '0').toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ExpressBath() {
  return (
    <MobileLayout>
      <ExpressBathContent />
    </MobileLayout>
  );
}
