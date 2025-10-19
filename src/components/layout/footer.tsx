import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <p className="text-gray-400 text-sm">
              © 2025 Disbursement Voucher Tracker. All rights reserved.
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-sm">Powered by</span>
            <Link 
              href="https://www.localwebventures.net/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity duration-200"
            >
              <img
                src="/LocalWebVentures-logo.png"
                alt="LocalWebVentures"
                className="h-8 w-auto object-contain"
                onError={(e) => {
                  // Fallback to text if image fails to load
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                }}
              />
              <span className="text-white font-semibold text-sm hidden">LocalWebVentures</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
