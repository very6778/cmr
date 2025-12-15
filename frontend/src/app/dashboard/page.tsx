import { ConvertForm } from '../components/convertForm'

export default function ConvertPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">PDF Oluştur</h1>
      <p className="mb-4 text-gray-600">
        Başlamak için bir .xlsx dosyası sürükleyin veya seçin.
      </p>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <ConvertForm />
      </div>
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Yönergeler:</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-600">
          <li>Dosyanın XLSX formatında olduğundan emin olun.</li>
          <li>Dosyanın gerekli bütün sütunları içerdiğiden emin olun.</li>
          <li>Dosyayı sürükleyin veya seçin.</li>
          <li>Oluşturulan dosyayı indirin.</li>
        </ol>
      </div>
    </div>
  )
}

