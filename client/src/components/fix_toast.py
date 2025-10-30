import re
import sys

def fix_toast_calls(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Reemplazar llamadas toast multilinea
    pattern = r'toast\(\{[^}]*title:\s*"([^"]*)"[^}]*description:\s*"([^"]*)"[^}]*\}\);'
    content = re.sub(pattern, r'console.log("✅ \1: \2");', content, flags=re.DOTALL)
    
    # Reemplazar llamadas toast simples 
    pattern = r'toast\(\{[^}]*title:\s*"([^"]*)"[^}]*\}\);'
    content = re.sub(pattern, r'console.log("ℹ️ \1");', content, flags=re.DOTALL)
    
    # Reemplazar hooks useToast restantes
    content = re.sub(r'const \{ toast \} = useToast\(\);', '// Toast removed - using console.log instead', content)
    
    with open(filename, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    fix_toast_calls('control-panel.tsx')
    print("Toast calls fixed successfully")
