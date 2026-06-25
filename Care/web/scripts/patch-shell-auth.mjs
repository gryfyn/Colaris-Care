import fs from 'node:fs';
import path from 'node:path';

const root = process.env.TARGET_ROOT || 'D:\\Projects\\colaris-app\\Care\\web';

const files = [
  'src/components/app/Shell.jsx',
  'src/components/app/StaffShell.jsx',
];

function patchShell(file) {
  const full = path.join(root, file);
  let text = fs.readFileSync(full, 'utf8');

  if (!text.includes('import { logout } from "@/lib/client-auth";')) {
    text = text.replace(
      /import Onboarding from "\.\/Onboarding";\r?\n/,
      (match) => `${match}import { logout } from "@/lib/client-auth";\n`
    );
    text = text.replace(
      /import \{ STAFF_NAV_FLAT, STAFF_NAV_GROUPS, usePrefs \} from "\.\/prefs";\r?\n/,
      (match) => `${match}import { logout } from "@/lib/client-auth";\n`
    );
  }

  text = text.replace(
    /const signOut = \(\) => \{\r?\n\s*setMenuOpen\(false\);\r?\n\s*router\.push\("\/"\);\r?\n\s*\};/,
    'const signOut = async () => {\n    setMenuOpen(false);\n    await logout();\n    router.push("/login");\n  };'
  );

  text = text.replace(
    /const signOut = \(\) => \{\r?\n\s*\/\/ No real auth yet[^\n]*\r?\n\s*setMenuOpen\(false\);\r?\n\s*router\.push\("\/"\);\r?\n\s*\};/,
    'const signOut = async () => {\n    setMenuOpen(false);\n    await logout();\n    router.push("/login");\n  };'
  );

  fs.writeFileSync(full, text);
  console.log(`patched ${file}`);
}

for (const file of files) patchShell(file);
