import { MobileLayout } from '@/components/layout/mobile-layout';
import { Badge } from '@/components/ui/badge';
import { Package, Search, RefreshCw, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';
import {
  DUMMY_ITEMS,
  CATEGORIES,
  CATEGORY_COLORS,
  getStockInfo,
} from '@/data/express-bath-items';
import type { ExpressBathItem } from '@/data/express-bath-items';

function ItemDetailModal({ item, onClose }: { item: ExpressBathItem; onClose: () => void }) {
  const available = parseFloat(item.quantityavailable || '0');
  const stock = getStockInfo(available);
  const catColor = CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/80 hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>

        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex items-center justify-center h-48 rounded-t-2xl relative">
          <ShoppingCart className="h-16 w-16 text-gray-300" />
          <div className="absolute top-4 left-4">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${catColor}`}>
              {item.category}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="text-xs text-gray-400 font-mono">{item.itemnumber}</p>
              <h2 className="text-xl font-bold text-gray-900 mt-1">{item.displayname}</h2>
            </div>
            <Badge variant="outline" className={`text-xs ml-3 shrink-0 ${stock.className}`}>
              {stock.label}
            </Badge>
          </div>

          {item.description && (
            <p className="text-sm text-gray-500 mt-2">{item.description}</p>
          )}

          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-900">
              ${item.baseprice || '0.00'}
            </span>
            {item.unittype && item.unittype !== 'Each' && (
              <span className="text-sm text-gray-400">/ {item.unittype}</span>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">On Hand</p>
              <p className="text-lg font-semibold text-gray-800 mt-0.5">
                {parseFloat(item.quantityonhand || '0').toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Available</p>
              <p className="text-lg font-semibold text-gray-800 mt-0.5">
                {available.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Committed</p>
              <p className="text-lg font-semibold text-gray-800 mt-0.5">
                {parseFloat(item.quantitycommitted || '0').toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">On Order</p>
              <p className="text-lg font-semibold text-gray-800 mt-0.5">
                {parseFloat(item.quantityonorder || '0').toLocaleString()}
              </p>
            </div>
          </div>

          {parseFloat(item.quantitybackordered || '0') > 0 && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-600 uppercase tracking-wider">Backordered</p>
              <p className="text-lg font-semibold text-amber-700 mt-0.5">
                {parseFloat(item.quantitybackordered || '0').toLocaleString()}
              </p>
            </div>
          )}

          {item.lastmodifieddate && (
            <p className="text-xs text-gray-400 mt-4 text-right">
              Last updated: {item.lastmodifieddate}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpressBathContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedItem, setSelectedItem] = useState<ExpressBathItem | null>(null);
  const items = DUMMY_ITEMS;

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeCategory !== 'All') {
      result = result.filter(item => item.category === activeCategory);
    }
    if (!searchTerm.trim()) return result;
    const term = searchTerm.toLowerCase();
    return result.filter(item =>
      (item.itemnumber || '').toLowerCase().includes(term) ||
      (item.displayname || '').toLowerCase().includes(term) ||
      (item.description || '').toLowerCase().includes(term)
    );
  }, [items, searchTerm, activeCategory]);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Express Bath</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredItems.length} of {items.length} products
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {}}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Package className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium text-gray-500">No products found</p>
          <p className="text-sm mt-1">Try a different search or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const available = parseFloat(item.quantityavailable || '0');
            const stock = getStockInfo(available);
            const catColor = CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-700';

            return (
              <div
                key={item.internalid}
                onClick={() => setSelectedItem(item)}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer"
              >
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center h-40 relative">
                  <ShoppingCart className="h-12 w-12 text-gray-300 group-hover:text-gray-400 transition-colors" />
                  <div className="absolute top-3 left-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${catColor}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Badge variant="outline" className={`text-xs ${stock.className}`}>
                      {stock.label}
                    </Badge>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-xs text-gray-400 font-mono mb-1">{item.itemnumber}</p>
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1 line-clamp-2">
                    {item.displayname}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                  )}
                  <div className="flex items-end justify-between">
                    <span className="text-xl font-bold text-gray-900">
                      ${item.baseprice || '0.00'}
                    </span>
                    {item.unittype && item.unittype !== 'Each' && (
                      <span className="text-xs text-gray-400">/{item.unittype}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
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
