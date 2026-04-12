This sets the copyright in the exe file properties. However, to fully fix the "Unknown Publisher" warning in the Windows install dialog, you need a code signing certificate. Without it, Windows will always show "Unknown Publisher" because the OS doesn't trust unsigned executables.

Options for code signing:

Free option — Use SignPath which offers free code signing for open-source projects
Paid option — Purchase an EV or OV code signing certificate from providers like DigiCert, Sectigo, or SSL.com (~$200-400/year)
Self-signed (not recommended) — Won't remove the warning on other machines
Once you have a certificate, you'd add to the win config:

"certificateFile": "path/to/certificate.pfx",
"certificatePassword": "your-password"
This is a Windows security requirement — no config change alone can make the "Unknown Publisher" go away without code signing.
