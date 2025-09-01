// 圖片壓縮工具
class ImageCompressor {
	constructor(options = {}) {
		this.options = {
			quality: 0.8,
			maxWidth: 1920,
			maxHeight: 1080,
			...options
		};
	}

	// 壓縮圖片
	async compress(file) {
		return new Promise((resolve, reject) => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			const img = new Image();

			img.onload = () => {
				// 計算新的尺寸
				const { width, height } = this.calculateDimensions(img.width, img.height);
				
				canvas.width = width;
				canvas.height = height;

				// 繪製圖片
				ctx.drawImage(img, 0, 0, width, height);

				// 轉換為 Blob
				canvas.toBlob(
					(blob) => {
						if (blob) {
							// 創建新的 File 物件
							const compressedFile = new File([blob], file.name, {
								type: file.type,
								lastModified: Date.now()
							});
							resolve(compressedFile);
						} else {
							reject(new Error('圖片壓縮失敗'));
						}
					},
					file.type,
					this.options.quality
				);
			};

			img.onerror = () => reject(new Error('圖片載入失敗'));
			img.src = URL.createObjectURL(file);
		});
	}

	// 計算新的尺寸
	calculateDimensions(width, height) {
		const { maxWidth, maxHeight } = this.options;
		
		if (width <= maxWidth && height <= maxHeight) {
			return { width, height };
		}

		const ratio = Math.min(maxWidth / width, maxHeight / height);
		return {
			width: Math.round(width * ratio),
			height: Math.round(height * ratio)
		};
	}

	// 檢查是否需要壓縮
	needsCompression(file) {
		const maxSize = 1024; // 1MB（進一步降低觸發條件）
		return file.size > maxSize;
	}
}

// 全域實例
window.imageCompressor = new ImageCompressor();
