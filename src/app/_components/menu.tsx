import {LocaleSwitcher} from "./locale-switcher";

export default function Menu() {
  return (
    <nav className="bg-orange-200 p-4 text-center">
      <p>Menu</p>
      <LocaleSwitcher />
    </nav>
  );
}