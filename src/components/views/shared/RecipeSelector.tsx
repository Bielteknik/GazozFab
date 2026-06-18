import React from 'react';
import { Shield, Target, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SystemData } from '../../../types/system';

interface RecipeSelectorProps {
  data: SystemData;
  disabled?: boolean;
  onSelectRecipe: (id: string) => void;
}

export const RecipeSelector: React.FC<RecipeSelectorProps> = ({ data, disabled, onSelectRecipe }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 flex-shrink-0">
      {data.recipes.length > 0 ? (
        data.recipes.map((recipe) => (
          <button
            key={recipe.id}
            disabled={disabled}
            onClick={() => onSelectRecipe(recipe.id)}
            className={cn(
              "p-2 rounded border-2 transition-all flex flex-col items-start gap-1 relative overflow-hidden text-left w-full",
              data.config.recipeId === recipe.id 
                ? "bg-blue-900/20 border-blue-500 ring-4 ring-blue-500/10" 
                : "bg-[#151921] border-[#2D333F] hover:border-gray-500",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <div className="flex justify-between w-full items-center">
              <span className={cn("text-xs font-bold truncate", data.config.recipeId === recipe.id ? "text-blue-400" : "text-white")}>
                {recipe.name}
              </span>
              {data.config.recipeId === recipe.id && (
                <div className="p-0.5 bg-blue-500 rounded-full flex-shrink-0">
                  <Shield size={8} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-1 font-mono text-[9px]">
              <div className="flex items-center gap-1 text-gray-400">
                 <Target size={10} /> {recipe.targetCount} Adet
              </div>
              <div className="flex items-center gap-1 text-gray-400">
                 <RefreshCw size={10} /> {recipe.fillTimeMs/1000}s
              </div>
            </div>
          </button>
        ))
      ) : (
        <div className="col-span-full bg-[#151921] border border-dashed border-gray-700/50 rounded p-2 text-center text-xs text-gray-500 font-bold flex items-center justify-center gap-2 h-[48px] select-none">
          <AlertTriangle size={14} className="text-amber-500/70" />
          <span>Sistemde tanımlı reçete bulunmuyor. Ayarlar sayfasından reçete ekleyin.</span>
        </div>
      )}
    </div>
  );
};
