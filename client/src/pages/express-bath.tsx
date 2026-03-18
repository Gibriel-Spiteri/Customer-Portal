import { MobileLayout } from '@/components/layout/mobile-layout';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Search,
  RefreshCw,
  ShoppingCart,
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
  category: string;
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
    category: 'Vanities',
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
    baseprice: '1,299.99',
    unittype: 'Each',
    lastmodifieddate: '03/14/2026',
    category: 'Vanities',
  },
  {
    internalid: '10003',
    itemnumber: 'EB-MIR-24RND',
    displayname: '24" Round LED Mirror',
    description: 'Frameless LED backlit mirror with anti-fog technology',
    itemtype: 'InvtPart',
    quantityonhand: '72',
    quantityavailable: '65',
    quantitycommitted: '7',
    quantityonorder: '0',
    quantitybackordered: '0',
    baseprice: '199.99',
    unittype: 'Each',
    lastmodifieddate: '03/12/2026',
    category: 'Mirrors',
  },
  {
    internalid: '10004',
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
    category: 'Faucets',
  },
  {
    internalid: '10005',
    itemnumber: 'EB-TIL-MRBWHT',
    displayname: 'Marble Hex Tile - White',
    description: 'Natural marble hexagon mosaic tile per sq ft',
    itemtype: 'InvtPart',
    quantityonhand: '2400',
    quantityavailable: '1800',
    quantitycommitted: '600',
    quantityonorder: '1000',
    quantitybackordered: '200',
    baseprice: '12.99',
    unittype: 'SqFt',
    lastmodifieddate: '03/10/2026',
    category: 'Tile',
  },
  {
    internalid: '10006',
    itemnumber: 'EB-SHW-RNSYS',
    displayname: 'Rain Shower System - Brushed Nickel',
    description: 'Complete rain shower system with handheld spray',
    itemtype: 'InvtPart',
    quantityonhand: '8',
    quantityavailable: '3',
    quantitycommitted: '5',
    quantityonorder: '25',
    quantitybackordered: '10',
    baseprice: '449.99',
    unittype: 'Each',
    lastmodifieddate: '03/11/2026',
    category: 'Showers',
  },
  {
    internalid: '10007',
    itemnumber: 'EB-TUB-FREE60',
    displayname: '60" Freestanding Soaking Tub',
    description: 'Acrylic freestanding oval bathtub',
    itemtype: 'InvtPart',
    quantityonhand: '5',
    quantityavailable: '0',
    quantitycommitted: '5',
    quantityonorder: '10',
    quantitybackordered: '8',
    baseprice: '1,599.99',
    unittype: 'Each',
    lastmodifieddate: '03/13/2026',
    category: 'Tubs',
  },
  {
    internalid: '10008',
    itemnumber: 'EB-TOI-ELNG',
    displayname: 'Elongated Comfort Height Toilet',
    description: 'Two-piece elongated toilet with slow-close seat',
    itemtype: 'InvtPart',
    quantityonhand: '34',
    quantityavailable: '28',
    quantitycommitted: '6',
    quantityonorder: '0',
    quantitybackordered: '0',
    baseprice: '349.99',
    unittype: 'Each',
    lastmodifieddate: '03/09/2026',
    category: 'Toilets',
  },
  {
    internalid: '10009',
    itemnumber: 'EB-CAB-MED30',
    displayname: '30" Recessed Medicine Cabinet',
    description: 'Mirror medicine cabinet with adjustable shelves',
    itemtype: 'InvtPart',
    quantityonhand: '22',
    quantityavailable: '19',
    quantitycommitted: '3',
    quantityonorder: '10',
    quantitybackordered: '0',
    baseprice: '249.99',
    unittype: 'Each',
    lastmodifieddate: '03/08/2026',
    category: 'Storage',
  },
  {
    internalid: '10010',
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
    category: 'Accessories',
  },
  {
    internalid: '10011',
    itemnumber: 'EB-LGT-VAN3',
    displayname: '3-Light Vanity Light - Brass',
    description: 'Modern 3-light vanity sconce with clear glass',
    itemtype: 'InvtPart',
    quantityonhand: '41',
    quantityavailable: '38',
    quantitycommitted: '3',
    quantityonorder: '0',
    quantitybackordered: '0',
    baseprice: '159.99',
    unittype: 'Each',
    lastmodifieddate: '03/06/2026',
    category: 'Lighting',
  },
  {
    internalid: '10012',
    itemnumber: 'EB-FLR-VYPLNK',
    displayname: 'Luxury Vinyl Plank - Waterproof',
    description: 'Waterproof luxury vinyl plank flooring for bathrooms per sq ft',
    itemtype: 'InvtPart',
    quantityonhand: '5200',
    quantityavailable: '4100',
    quantitycommitted: '1100',
    quantityonorder: '2000',
    quantitybackordered: '0',
    baseprice: '4.49',
    unittype: 'SqFt',
    lastmodifieddate: '03/17/2026',
    category: 'Flooring',
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(DUMMY_ITEMS.map(i => i.category)))];

function getStockInfo(quantityAvailable: number) {
  if (quantityAvailable > 10) {
    return { label: 'In Stock', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  } else if (quantityAvailable > 0) {
    return { label: 'Low Stock', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  return { label: 'Out of Stock', className: 'bg-red-50 text-red-700 border-red-200' };
}

const CATEGORY_COLORS: Record<string, string> = {
  'Vanities': 'bg-indigo-100 text-indigo-700',
  'Mirrors': 'bg-sky-100 text-sky-700',
  'Faucets': 'bg-cyan-100 text-cyan-700',
  'Tile': 'bg-violet-100 text-violet-700',
  'Showers': 'bg-blue-100 text-blue-700',
  'Tubs': 'bg-teal-100 text-teal-700',
  'Toilets': 'bg-slate-100 text-slate-700',
  'Storage': 'bg-orange-100 text-orange-700',
  'Accessories': 'bg-pink-100 text-pink-700',
  'Lighting': 'bg-yellow-100 text-yellow-700',
  'Flooring': 'bg-lime-100 text-lime-700',
};

function ExpressBathContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
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
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200"
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

                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <span className="text-xl font-bold text-gray-900">
                        ${item.baseprice || '0.00'}
                      </span>
                      {item.unittype && item.unittype !== 'Each' && (
                        <span className="text-xs text-gray-400 ml-1">/{item.unittype}</span>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
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
