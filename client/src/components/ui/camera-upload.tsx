import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  className?: string;
}

export function CameraUpload({ onFileSelect, accept = "image/*", className }: CameraUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      onFileSelect(file);
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const clearPreview = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {preview ? (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <img 
                src={preview} 
                alt="Preview" 
                className="w-full max-w-sm mx-auto rounded-lg"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={clearPreview}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="p-6 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <Camera className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Upload a photo</h3>
                <p className="text-sm text-gray-500">Take a photo or select from gallery</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  onClick={handleCameraCapture}
                  className="touch-manipulation"
                  size="lg"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="touch-manipulation"
                  size="lg"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Hidden file inputs for camera and gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        capture="environment" // Use rear camera by default
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}