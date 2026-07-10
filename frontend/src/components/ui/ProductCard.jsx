import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, ShieldCheck, Pill } from 'lucide-react';
import { Card, Button, StatusBadge, PriceTag, Rating } from './index';

export const ProductCard = ({ medicine, onAddToCart, onBuyNow, onViewDetails }) => {
  const isAvailable = medicine.actual_qty > 0;
  
  return (
    <motion.div whileHover={{ y: -8 }} className="h-full">
      <Card hover className="h-full flex flex-col overflow-hidden p-2 group">
        <div className="relative p-4 bg-slate-50/50 rounded-[16px] aspect-square flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => onViewDetails(medicine)}>
          {medicine.image ? (
            <img src={medicine.image} alt={medicine.medicine_name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 ease-out" />
          ) : (
            <Pill className="w-20 h-20 text-slate-200 group-hover:scale-110 group-hover:text-blue-100 transition-all duration-500" />
          )}
          
          <div className="absolute top-3 left-3">
            <StatusBadge status={isAvailable ? 'In Stock' : 'Out of Stock'} />
          </div>
          
          <button className="absolute top-3 right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:shadow-lg shadow-sm transition-all duration-300 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0">
            <Heart className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="cursor-pointer" onClick={() => onViewDetails(medicine)}>
              <h3 className="font-extrabold text-lg text-slate-900 leading-tight line-clamp-2 hover:text-blue-600 transition-colors">
                {medicine.medicine_name}
              </h3>
              <p className="text-sm font-medium text-slate-500 mt-1 truncate">{medicine.generic_name || 'Generic Medicine'}</p>
              <p className="text-sm font-medium text-slate-500 mt-1 truncate">{medicine.brand || 'Brand Medicine'}</p>    
            </div>
          </div>
          
          <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{medicine.manufacturer || 'Verified Manufacturer'}</span>
          </div>
          
          <div className="mt-auto">
            <div className="flex items-end justify-between mb-4">
              <PriceTag price={medicine.selling_price} mrp={medicine.mrp} />
              <Rating value={4.8} count={Math.floor(Math.random() * 500) + 50} />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                className="w-12 shrink-0 p-0" 
                onClick={(e) => { e.stopPropagation(); onAddToCart(medicine, 1); }}
                disabled={!isAvailable}
              >
                <ShoppingCart className="w-5 h-5" />
              </Button>
              <Button 
                variant="primary" 
                className="flex-1" 
                onClick={(e) => { e.stopPropagation(); onBuyNow(medicine, 1); }}
                disabled={!isAvailable}
              >
                Buy Now
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
