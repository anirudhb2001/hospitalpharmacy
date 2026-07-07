import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { medicineService } from '../../services';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore } from '../../stores/useCartStore';

// Layout Components
import { Hero } from '../../components/layout/Hero';
import { KPICards } from '../../components/layout/KPICards';
import { CategorySection } from '../../components/layout/CategorySection';
import { MedicineGrid } from '../../components/layout/MedicineGrid';
import { PrescriptionBanner, ServicesSection, Testimonials } from '../../components/layout/Sections';
import { Modal, Button, PriceTag, Rating, StatusBadge } from '../../components/ui';

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const { addItem } = useCartStore();
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState({
    search: '', category: '', brand: '', availability: '', sort: 'name', page: 1,
  });

  // KPI stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['portalStats'],
    queryFn: medicineService.getPortalStats,
    staleTime: 60_000,
  });

  // Filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['medicineFilters'],
    queryFn: medicineService.getFilters,
    staleTime: 300_000,
  });

  // Medicine list
  const { data: medicineData, isLoading: medicinesLoading } = useQuery({
    queryKey: ['medicines', filters],
    queryFn: () => medicineService.getList(filters),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const medicines = medicineData?.medicines || [];

  const handleBuyNow = (medicine) => {
    addItem(medicine);
    navigate('/cart');
  };

  const handleAddToCart = (medicine) => {
    addItem(medicine);
    import('react-hot-toast').then(({ toast }) => toast.success(`${medicine.medicine_name} added to cart!`));
  };

  const [selectedMedicine, setSelectedMedicine] = useState(null);

  const handleViewDetails = (medicine) => {
    setSelectedMedicine(medicine);
  };

  const handleSelectCategory = (category) => {
    setFilters(f => ({ ...f, category: category === f.category ? '' : category, page: 1 }));
    window.scrollTo({ top: document.getElementById('medicine-grid')?.offsetTop - 100, behavior: 'smooth' });
  };

  const hasActiveFilters = !!(filters.search || filters.category || filters.brand);

  const handleClearFilters = () => {
    setFilters({ search: '', category: '', brand: '', availability: '', sort: 'name', page: 1 });
  };

  React.useEffect(() => {
    const handleClear = () => handleClearFilters();
    const handleSearch = (e) => {
      setFilters(f => ({ ...f, search: e.detail, page: 1 }));
    };
    window.addEventListener('clear-medicine-filters', handleClear);
    window.addEventListener('set-medicine-search', handleSearch);
    return () => {
      window.removeEventListener('clear-medicine-filters', handleClear);
      window.removeEventListener('set-medicine-search', handleSearch);
    };
  }, []);

  return (
    <div className="w-full">
      <Hero />
      <KPICards stats={stats} isLoading={statsLoading} />
      
      <div className="mt-8">
        <CategorySection onSelectCategory={handleSelectCategory} />
        
        <div id="medicine-grid">
          <MedicineGrid 
            medicines={medicines} 
            isLoading={medicinesLoading}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onViewDetails={handleViewDetails}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />

          {medicineData?.total > (medicineData?.page_size || 12) && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <Button
                variant="secondary"
                disabled={filters.page === 1 || medicinesLoading}
                onClick={() => {
                  setFilters(f => ({ ...f, page: f.page - 1 }));
                  window.scrollTo({ top: document.getElementById('medicine-grid')?.offsetTop - 100, behavior: 'smooth' });
                }}
              >
                Previous
              </Button>
              <span className="text-sm font-bold text-slate-500">
                Page {filters.page} of {Math.ceil(medicineData.total / (medicineData.page_size || 12))}
              </span>
              <Button
                variant="secondary"
                disabled={filters.page === Math.ceil(medicineData.total / (medicineData.page_size || 12)) || medicinesLoading}
                onClick={() => {
                  setFilters(f => ({ ...f, page: f.page + 1 }));
                  window.scrollTo({ top: document.getElementById('medicine-grid')?.offsetTop - 100, behavior: 'smooth' });
                }}
              >
                Next
              </Button>
            </div>
          )}
        </div>
        
        <PrescriptionBanner />
        <ServicesSection />
        <Testimonials />
      </div>

      <Modal isOpen={!!selectedMedicine} onClose={() => setSelectedMedicine(null)} className="max-w-2xl p-0 overflow-hidden">
        {selectedMedicine && (
          <div className="flex flex-col sm:flex-row h-full max-h-[90vh]">
            <div className="w-full sm:w-2/5 bg-slate-50 p-8 flex items-center justify-center">
              {selectedMedicine.image ? (
                <img src={selectedMedicine.image} alt={selectedMedicine.medicine_name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-32 h-32 bg-slate-200 rounded-full flex items-center justify-center text-slate-400">No Image</div>
              )}
            </div>
            <div className="w-full sm:w-3/5 p-8 flex flex-col overflow-y-auto">
              <div className="mb-4">
                <StatusBadge status={selectedMedicine.actual_qty > 0 ? 'In Stock' : 'Out of Stock'} className="mb-3 inline-flex" />
                <h2 className="text-2xl font-black text-slate-900 leading-tight mb-2">{selectedMedicine.medicine_name}</h2>
                <p className="text-slate-500 font-medium">{selectedMedicine.generic_name || selectedMedicine.category}</p>
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <PriceTag price={selectedMedicine.selling_price} mrp={selectedMedicine.mrp} />
                <Rating value={4.8} count={124} />
              </div>
              
              <div className="prose prose-sm text-slate-600 mb-8 flex-1">
                <p>{selectedMedicine.description || 'No description available for this medicine.'}</p>
                {selectedMedicine.manufacturer && (
                  <p className="mt-4"><span className="font-bold">Manufacturer:</span> {selectedMedicine.manufacturer}</p>
                )}
              </div>
              
              <div className="flex gap-3 mt-auto">
                <Button variant="secondary" className="flex-1" onClick={() => { handleAddToCart(selectedMedicine); setSelectedMedicine(null); }} disabled={selectedMedicine.actual_qty <= 0}>
                  Add to Cart
                </Button>
                <Button variant="primary" className="flex-1" onClick={() => handleBuyNow(selectedMedicine)} disabled={selectedMedicine.actual_qty <= 0}>
                  Buy Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
