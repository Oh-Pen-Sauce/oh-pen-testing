# Homebrew formula for Oh Pen Testing.
#
# Installation path for users:
#   brew tap oh-pen-sauce/tap
#   brew install oh-pen-testing
#
# This file lives in the main repo for reference; the actual tap lives at
# https://github.com/Oh-Pen-Sauce/homebrew-tap. The release workflow
# (`.github/workflows/release.yml`) bumps the version + sha256 in the tap
# whenever a new `v*` tag is pushed here.

class OhPenTesting < Formula
  desc "Local, opensource penetration testing suite. Your code. Your AI. Your terms."
  homepage "https://github.com/Oh-Pen-Sauce/oh-pen-testing"
  url "https://registry.npmjs.org/@oh-pen-testing/cli/-/cli-0.6.0.tgz"
  sha256 "REPLACE_WITH_PUBLISHED_TARBALL_SHA256"
  license "MIT"

  depends_on "node@22"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "oh-pen-testing", shell_output("#{bin}/opt --help")
    assert_match "0.6.0", shell_output("#{bin}/opt --version")
  end
end
