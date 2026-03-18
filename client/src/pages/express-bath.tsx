import { MobileLayout } from '@/components/layout/mobile-layout';
import { Badge } from '@/components/ui/badge';
import { Package, Search, RefreshCw, ShoppingCart, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

interface ExpressBathItem {
  internalid: string;
  itemnumber: string;
  displayname: string | null;
  description: string | null;
  itemtype: string;
  quantityonhand: string;
  quantityavailable: string;
  quantitycommitted: string;
  quantityonorder: string;
  quantitybackordered: string;
  baseprice: string | null;
  thumbnailurl: string | null;
  unittype: string | null;
  lastmodifieddate: string | null;
}

function stockInfo(qty: number) {
  if (qty > 10) return { label: 'In Stock', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (qty > 0) return { label: 'Low Stock', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Out of Stock', cls: 'bg-red-50 text-red-700 border-red-200' };
}

function itemName(item: ExpressBathItem): string {
  return item.displayname || item.description || item.itemnumber;
}

function getItemCategory(item: ExpressBathItem): string {
  const num = item.itemnumber || '';
  const parts = num.split('-');
  const prefix = parts[0];
  const second = parts[1] || '';

  if (prefix.startsWith('QZ')) return 'Quartz Tops';
  if (second.startsWith('V') || prefix.startsWith('ANC')) return 'Vanity Cabinets';
  if (prefix === 'C') return 'Toilets';
  if (prefix === 'L') return 'Lavatories';
  return 'Other';
}

function DetailModal({ item, onClose }: { item: ExpressBathItem; onClose: () => void }) {
  const avail = parseFloat(item.quantityavailable || '0');
  const si = stockInfo(avail);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/80 hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>

        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 flex items-center justify-center h-48 rounded-t-2xl relative">
          {item.thumbnailurl ? (
            <img src={item.thumbnailurl} alt={itemName(item)} className="max-h-full max-w-full object-contain" />
          ) : (
            <ShoppingCart className="h-16 w-16 text-gray-300" />
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="text-xs text-gray-400 font-mono">{item.itemnumber}</p>
              <h2 className="text-xl font-bold text-gray-900 mt-1">{itemName(item)}</h2>
            </div>
            <Badge variant="outline" className={`text-xs ml-3 shrink-0 ${si.cls}`}>{si.label}</Badge>
          </div>

          {item.description && item.displayname && <p className="text-sm text-gray-500 mt-2">{item.description}</p>}

          {item.baseprice && (
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">${parseFloat(item.baseprice).toFixed(2)}</span>
              {item.unittype && item.unittype !== 'EACH' && (
                <span className="text-sm text-gray-400">/ {item.unittype}</span>
              )}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">On Hand</p>
              <p className="text-lg font-semibold text-gray-800 mt-0.5">{parseFloat(item.quantityonhand || '0').toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Available</p>
              <p className="text-lg font-semibold text-gray-800 mt-0.5">{avail.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Committed</p>
              <p className="text-lg font-semibold text-gray-800 mt-0.5">{parseFloat(item.quantitycommitted || '0').toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">On Order</p>
              <p className="text-lg font-semibold text-gray-800 mt-0.5">{parseFloat(item.quantityonorder || '0').toLocaleString()}</p>
            </div>
          </div>

          {parseFloat(item.quantitybackordered || '0') > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-600 uppercase tracking-wider">Backordered</p>
              <p className="text-lg font-semibold text-amber-700 mt-0.5">{parseFloat(item.quantitybackordered || '0').toLocaleString()}</p>
            </div>
          )}

          {item.lastmodifieddate && (
            <p className="text-xs text-gray-400 mt-4 text-right">Last updated: {item.lastmodifieddate}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpressBathContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [selected, setSelected] = useState<ExpressBathItem | null>(null);

  const { data, isLoading, isError, error } = useQuery<{ success: boolean; items: ExpressBathItem[]; count: number; hasMore: boolean; totalResults: number }>({
    queryKey: ['/api/express-bath/items'],
  });

  const items = data?.items || [];

  const categories = useMemo(() => {
    const cats = new Set(items.map(i => getItemCategory(i)));
    return ['All', ...Array.from(cats).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let r = items;
    if (activeCat !== 'All') r = r.filter(i => getItemCategory(i) === activeCat);
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      r = r.filter(i =>
        (i.itemnumber || '').toLowerCase().includes(t) ||
        (i.displayname || '').toLowerCase().includes(t) ||
        (i.description || '').toLowerCase().includes(t)
      );
    }
    return r;
  }, [items, searchTerm, activeCat]);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Express Bath</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading ? 'Loading...' : `${filtered.length} of ${items.length} products`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/express-bath/items'] })}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative flex-1 mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-10" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {categories.map((c) => (
          <button key={c} onClick={() => setActiveCat(c)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCat === c ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg font-medium text-gray-500">Loading products...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-red-400">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium text-red-500">Failed to load products</p>
          <p className="text-sm mt-1 text-red-400">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/express-bath/items'] })}
          >
            Try Again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Package className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium text-gray-500">No products found</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const avail = parseFloat(item.quantityavailable || '0');
            const si = stockInfo(avail);
            return (
              <div key={item.internalid} onClick={() => setSelected(item)} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 flex items-center justify-center h-40 relative">
                  {item.thumbnailurl ? (
                    <img src={item.thumbnailurl} alt={itemName(item)} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ShoppingCart className="h-12 w-12 text-gray-300 group-hover:text-gray-400 transition-colors" />
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge variant="outline" className={`text-xs ${si.cls}`}>{si.label}</Badge>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs text-gray-400 font-mono mb-1">{item.itemnumber}</p>
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1 line-clamp-2">{itemName(item)}</h3>
                  {item.description && item.displayname && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{item.description}</p>}
                  <div className="flex items-end justify-between">
                    {item.baseprice ? (
                      <span className="text-xl font-bold text-gray-900">${parseFloat(item.baseprice).toFixed(2)}</span>
                    ) : (
                      <span className="text-sm text-gray-400">Price N/A</span>
                    )}
                    {item.unittype && item.unittype !== 'EACH' && <span className="text-xs text-gray-400">/{item.unittype}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
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
