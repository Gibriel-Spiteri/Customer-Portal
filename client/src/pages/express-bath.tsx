import { MobileLayout } from '@/components/layout/mobile-layout';
import { Badge } from '@/components/ui/badge';
import { Package, Search, RefreshCw, ShoppingCart, X, Loader2, AlertCircle, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  storedescription: string | null;
  thumbnailurl: string | null;
  unittype: string | null;
  lastmodifieddate: string | null;
  sitecategory: string | null;
}

function stockInfo(qty: number) {
  if (qty > 0) return { label: 'In Stock', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  return { label: 'Back Soon', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
}

function itemName(item: ExpressBathItem): string {
  return item.displayname || item.description || item.itemnumber;
}

function getItemCategory(item: ExpressBathItem): string {
  return item.sitecategory || 'Other';
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

        <div className="bg-white p-4 flex items-center justify-center h-48 rounded-t-2xl relative">
          {item.thumbnailurl ? (
            <img src={item.thumbnailurl} alt={itemName(item)} className="max-h-full max-w-full object-contain" />
          ) : (
            <ShoppingCart className="h-16 w-16 text-gray-300" />
          )}
        </div>

        <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-b-2xl">
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

          {item.storedescription && (
            <div
              className="mt-4 text-sm text-gray-600 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
              dangerouslySetInnerHTML={{ __html: item.storedescription }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ExpressBathContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('name-asc');
  const [inStockOnly, setInStockOnly] = useState(false);
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
    if (inStockOnly) r = r.filter(i => parseFloat(i.quantityavailable || '0') > 0);
    if (activeCat !== 'All') r = r.filter(i => getItemCategory(i) === activeCat);
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      r = r.filter(i =>
        (i.itemnumber || '').toLowerCase().includes(t) ||
        (i.displayname || '').toLowerCase().includes(t) ||
        (i.description || '').toLowerCase().includes(t)
      );
    }
    const sorted = [...r];
    switch (sortBy) {
      case 'name-asc':
        sorted.sort((a, b) => itemName(a).localeCompare(itemName(b)));
        break;
      case 'name-desc':
        sorted.sort((a, b) => itemName(b).localeCompare(itemName(a)));
        break;
      case 'price-asc':
        sorted.sort((a, b) => (parseFloat(a.baseprice || '0') - parseFloat(b.baseprice || '0')));
        break;
      case 'price-desc':
        sorted.sort((a, b) => (parseFloat(b.baseprice || '0') - parseFloat(a.baseprice || '0')));
        break;
      case 'stock-desc':
        sorted.sort((a, b) => (parseFloat(b.quantityavailable || '0') - parseFloat(a.quantityavailable || '0')));
        break;
    }
    return sorted;
  }, [items, searchTerm, activeCat, sortBy, inStockOnly]);

  return (
    <div className="pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Express Bath</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading ? 'Loading...' : `${filtered.length} of ${items.length} products`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <List className="h-4 w-4" />
            </button>
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
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px] h-10">
            <ArrowUpDown className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name A–Z</SelectItem>
            <SelectItem value="name-desc">Name Z–A</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
            <SelectItem value="stock-desc">Stock: Most Available</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCat === c ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <label htmlFor="in-stock-toggle" className="text-sm font-medium text-gray-600 whitespace-nowrap cursor-pointer">In Stock</label>
          <Switch id="in-stock-toggle" checked={inStockOnly} onCheckedChange={setInStockOnly} />
        </div>
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
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const avail = parseFloat(item.quantityavailable || '0');
            const si = stockInfo(avail);
            return (
              <div key={item.internalid} onClick={() => setSelected(item)} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer">
                <div className="bg-white p-4 flex items-center justify-center h-40 relative">
                  {item.thumbnailurl ? (
                    <img src={item.thumbnailurl} alt={itemName(item)} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ShoppingCart className="h-12 w-12 text-gray-300 group-hover:text-gray-400 transition-colors" />
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge variant="outline" className={`text-xs ${si.cls}`}>{si.label}</Badge>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100">
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
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => {
            const avail = parseFloat(item.quantityavailable || '0');
            const si = stockInfo(avail);
            return (
              <div key={item.internalid} onClick={() => setSelected(item)} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer flex items-center gap-4 p-3">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center h-16 w-16 shrink-0">
                  {item.thumbnailurl ? (
                    <img src={item.thumbnailurl} alt={itemName(item)} className="max-h-full max-w-full object-contain rounded-lg" />
                  ) : (
                    <ShoppingCart className="h-6 w-6 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{itemName(item)}</h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{item.itemnumber}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className={`text-xs ${si.cls}`}>{si.label}</Badge>
                  {item.baseprice ? (
                    <span className="text-base font-bold text-gray-900 w-24 text-right">${parseFloat(item.baseprice).toFixed(2)}</span>
                  ) : (
                    <span className="text-sm text-gray-400 w-24 text-right">N/A</span>
                  )}
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
