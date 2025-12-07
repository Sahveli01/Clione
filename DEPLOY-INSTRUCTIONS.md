# 🚀 Deployment Talimatları

## ⚠️ ÖNEMLİ: Permission Hatası Çözümü

Eğer "Erişim engellendi" (Access Denied) hatası alıyorsan:

### Windows'ta Çözüm:

1. **PowerShell'i Administrator olarak aç:**
   - Windows tuşuna bas
   - "PowerShell" yaz
   - Sağ tık → "Run as Administrator"

2. **Proje dizinine git:**
   ```powershell
   cd "C:\Users\sahve\OneDrive\Masaüstü\Sui-Drop"
   ```

3. **Deployment yap:**
   ```powershell
   .\deploy.ps1
   ```

4. **Config'i güncelle:**
   ```powershell
   npm run post-deploy
   ```

5. **Package ID'yi gör:**
   ```powershell
   .\get-package-id.ps1
   ```

---

## Alternatif: Manuel Deployment

Eğer script çalışmazsa:

```powershell
# 1. Contracts dizinine git
cd contracts\sui_drop

# 2. Build
sui move build

# 3. Publish (JSON output'u dosyaya kaydet)
sui client publish --gas-budget 100000000 --skip-dependency-verification --json > ..\..\deploy-output.json 2>..\..\deploy-errors.log

# 4. Root'a dön
cd ..\..

# 5. Package ID'yi bul
.\get-package-id.ps1

# 6. Config güncelle
npm run post-deploy
```

---

## Package ID'yi Manuel Ekleme

Eğer `npm run post-deploy` çalışmazsa:

1. Package ID'yi bul:
   ```powershell
   .\get-package-id.ps1
   ```

2. `.env.local` dosyasını oluştur/düzenle:
   ```env
   NEXT_PUBLIC_SUI_NETWORK=testnet
   NEXT_PUBLIC_MARKET_PACKAGE_ID=0xBURAYA_PACKAGE_ID_GELECEK
   NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
   NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
   ```

---

## Sorun Giderme

### "Erişim engellendi" hatası:
- ✅ PowerShell'i Administrator olarak çalıştır
- ✅ Antivirus'ü geçici olarak kapat
- ✅ Dosyaları kullanan başka programları kapat

### "Package ID bulunamadı" hatası:
- ✅ `deploy-output.json` dosyasını kontrol et
- ✅ Deployment'ın başarılı olduğundan emin ol
- ✅ `deploy-errors.log` dosyasını kontrol et

