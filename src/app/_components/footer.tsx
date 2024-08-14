const navigation = {
  main: [
    { name: '📡 Stratux - anti-collision system', title: 'Stratux - anti-collision system for private aviation and gliders', href: 'https://dross.net/aviation/' },
    { name: 'Home', title: '', href: 'https://dross.net/' },
    { name: 'Imprint', title: 'Imprint', href: 'https://dross.net/imprint' },
    { name: 'Contact', title: 'Contact', href: 'https://dross.net/contact' },
    { name: 'Privacy Policy', title: 'Privacy Policy', href: 'https://dross.net/privacy-policy' },
  ]
}

export default function Footer() {
  return (
    <footer className="bg-white">
      <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
        <nav className="-mx-5 -my-2 flex flex-wrap justify-center" aria-label="Footer">
          {navigation.main.map((item) => (
            <div key={item.name} className="px-5 py-2">
              <a 
              href={item.href} 
              title={item.title}
              target="_blank"
              rel="noopener"
              className="text-base text-gray-500 hover:text-gray-900"
              >
                {item.name}
              </a>
            </div>
          ))}
        </nav>
        <p className="mt-8 text-center text-base text-gray-400">&copy; 2024 made with ♥ by{" "}
        <a
          href="https://dross.net/alexander/"
          rel="noopener"
          title="Website von Alexander Dross"
          target="_blank"
          className="text-gray-400 hover:text-gray-500"
        >
          Alexander Dross
        </a></p>
      </div>
    </footer>
  )
}