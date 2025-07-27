# Cross-platform installation test script for Windows
# Tests npm package installation and execution

Write-Host "🧪 EzEnv CLI Installation Test" -ForegroundColor Yellow
Write-Host "==============================" -ForegroundColor Yellow

# Get package info
$packageName = "@ezenv/cli"
$packageVersion = (Get-Content "package.json" | ConvertFrom-Json).version

# Create temp directory for testing
$testDir = New-TemporaryFile | %{ Remove-Item $_; New-Item -ItemType Directory -Path $_ }
Write-Host "Test directory: $testDir" -ForegroundColor Yellow

function Test-Install {
    param(
        [string]$method,
        [string]$command
    )
    
    Write-Host "`nTesting $method installation..." -ForegroundColor Yellow
    
    # Create a fresh test environment
    Set-Location $testDir
    New-Item -ItemType Directory -Path "$method-test" -Force | Out-Null
    Set-Location "$method-test"
    
    # Run installation
    Write-Host "Running: $command"
    try {
        Invoke-Expression $command
        Write-Host "✓ $method installation successful" -ForegroundColor Green
        
        # Test execution
        if ($method -eq "global") {
            $version = ezenv --version
            if ($version -match $packageVersion) {
                Write-Host "✓ ezenv command works" -ForegroundColor Green
            } else {
                Write-Host "✗ ezenv command failed" -ForegroundColor Red
                return $false
            }
        }
        return $true
    } catch {
        Write-Host "✗ $method installation failed" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        return $false
    }
}

function Test-Npx {
    Write-Host "`nTesting npx execution..." -ForegroundColor Yellow
    
    Set-Location $testDir
    New-Item -ItemType Directory -Path "npx-test" -Force | Out-Null
    Set-Location "npx-test"
    
    # Test npx without installation
    Write-Host "Running: npx $packageName --version"
    try {
        $output = npx $packageName --version
        if ($output -match $packageVersion) {
            Write-Host "✓ npx execution successful" -ForegroundColor Green
            return $true
        } else {
            Write-Host "✗ npx execution failed" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "✗ npx execution failed" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        return $false
    }
}

function Test-Commands {
    param([string]$execCmd)
    
    Write-Host "`nTesting commands with $execCmd..." -ForegroundColor Yellow
    
    # Test help
    try {
        & $execCmd --help | Out-Null
        Write-Host "✓ Help command works" -ForegroundColor Green
    } catch {
        Write-Host "✗ Help command failed" -ForegroundColor Red
    }
    
    # Test version
    try {
        $version = & $execCmd --version
        if ($version -match $packageVersion) {
            Write-Host "✓ Version command works" -ForegroundColor Green
        } else {
            Write-Host "✗ Version command failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Version command failed" -ForegroundColor Red
    }
    
    # Test auth status
    try {
        $output = & $execCmd auth status 2>&1
        if ($output -match "Not authenticated") {
            Write-Host "✓ Auth status command works" -ForegroundColor Green
        } else {
            Write-Host "✗ Auth status command failed" -ForegroundColor Red
        }
    } catch {
        # Expected to fail when not authenticated
        if ($_.Exception.Message -match "Not authenticated") {
            Write-Host "✓ Auth status command works" -ForegroundColor Green
        } else {
            Write-Host "✗ Auth status command failed" -ForegroundColor Red
        }
    }
}

# Main test sequence
function Main {
    Write-Host "`nPlatform: Windows PowerShell" -ForegroundColor Yellow
    Write-Host "Node version: $(node --version)" -ForegroundColor Yellow
    Write-Host "npm version: $(npm --version)" -ForegroundColor Yellow
    
    # Save current location
    $originalLocation = Get-Location
    
    try {
        # Test local installation
        Test-Install -method "local" -command "npm install $packageName"
        
        # Test global installation
        Test-Install -method "global" -command "npm install -g $packageName"
        
        # Test npx
        Test-Npx
        
        # Test commands with global install
        if (Get-Command ezenv -ErrorAction SilentlyContinue) {
            Test-Commands -execCmd "ezenv"
        }
        
        Write-Host "`n✅ All tests completed!" -ForegroundColor Green
    } finally {
        # Cleanup
        Write-Host "`nCleaning up..." -ForegroundColor Yellow
        Set-Location $originalLocation
        npm uninstall -g $packageName 2>$null
        Remove-Item -Path $testDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Run tests
Main