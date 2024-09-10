export default function Search({placeholder}: {placeholder: string}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        type="text"
        name="search"
        id="search"
        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md text-center"
        placeholder={placeholder}
      />
    </div>
  )
}