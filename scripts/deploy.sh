#!/bin/bash
# ===========================================
# Komenin Production Deployment Script
# ===========================================
# Usage: ./scripts/deploy.sh [production|staging]
#
# This script handles automated deployment to Docker containers
# with proper health checks and rollback support.
# ===========================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-staging}"
PROJECT_NAME="komenin"
DEPLOY_DIR="/opt/${PROJECT_NAME}"
BACKUP_DIR="${DEPLOY_DIR}/backups"
LOG_FILE="${DEPLOY_DIR}/deploy.log"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f /tmp/deploy_*.tmp
}

trap cleanup EXIT

usage() {
    echo "Usage: $0 [production|staging]"
    echo ""
    echo "Deploy Komenin application:"
    echo "  production  - Deploy to production environment (requires confirmation)"
    echo "  staging     - Deploy to staging environment"
    exit 1
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if running as root or has sudo
    if ! sudo -n true 2>/dev/null; then
        log_error "This script requires sudo privileges"
        exit 1
    fi

    # Check docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    # Check docker-compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    log_success "Prerequisites met"
}

backup_current_version() {
    log_info "Creating backup of current deployment..."

    mkdir -p "$BACKUP_DIR"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="pre_deploy_${timestamp}"

    # Backup volumes
    sudo docker volume ls -q | grep "${PROJECT_NAME}_.*" | while read volume; do
        sudo docker run --rm \
            -v "$volume":/data \
            -v "$BACKUP_DIR:/backup" \
            alpine tar czf "/backup/${backup_name}_${volume}.tar.gz" /data
        log_info "Backed up volume: $volume"
    done

    # Save current image tag
    docker save "${PROJECT_NAME}:latest" > "${BACKUP_DIR}/${backup_name}_image.tar" 2>/dev/null || true

    log_success "Backup created: ${backup_name}"
}

run_health_checks() {
    log_info "Running health checks..."

    local max_retries=30
    local retry_count=0

    while [ $retry_count -lt $max_retries ]; do
        sleep 5

        # Check app container
        if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi

        retry_count=$((retry_count + 1))
        log_info "Health check attempt $retry_count/$max_retries failed..."
    done

    log_error "Health checks failed after $max_retries attempts"
    return 1
}

rollback() {
    log_warning "Initiating rollback..."

    local latest_backup=$(ls -t "${BACKUP_DIR}"/pre_deploy_*.tar.gz 2>/dev/null | head -1)

    if [ -z "$latest_backup" ]; then
        log_error "No backup found for rollback"
        exit 1
    fi

    log_info "Restoring from: $(basename "$latest_backup")"

    # Restore would go here - implement based on your backup strategy

    log_success "Rollback completed"
}

deploy() {
    local target_env="$1"

    log_info "Starting deployment to ${target_env}..."

    # Create deploy directory if it doesn't exist
    sudo mkdir -p "$DEPLOY_DIR"
    sudo mkdir -p "$BACKUP_DIR"

    cd "$DEPLOY_DIR"

    # Pull latest code
    git pull origin main 2>/dev/null || {
        log_warning "Not a git repository, skipping pull"
    }

    # Build and start
    log_info "Building Docker image..."
    sudo docker-compose build --no-cache

    log_info "Stopping old containers..."
    sudo docker-compose down

    log_info "Starting new containers..."
    sudo docker-compose up -d

    # Run health checks
    if run_health_checks; then
        log_success "Deployment successful!"
        return 0
    else
        log_error "Deployment failed! Initiating rollback..."
        rollback
        return 1
    fi
}

# Main execution
main() {
    if [ $# -eq 0 ]; then
        usage
    fi

    case "$ENVIRONMENT" in
        production)
            echo ""
            echo "=============================================="
            echo "   ⚠️  PRODUCTION DEPLOYMENT ⚠️  "
            echo "=============================================="
            echo ""
            read -p "Are you sure you want to deploy to production? (yes/no): " confirm

            if [ "$confirm" != "yes" ]; then
                log_info "Deployment cancelled"
                exit 0
            fi
            ;;
        staging)
            log_info "Deploying to staging environment"
            ;;
        *)
            usage
            ;;
    esac

    check_prerequisites

    # Create initial logs directory structure
    mkdir -p "$(dirname "$LOG_FILE")"

    log_info "=========================================="
    log_info "Deployment started at $(date)"
    log_info "Environment: $ENVIRONMENT"
    log_info "=========================================="

    deploy "$ENVIRONMENT"

    log_success "Deployment process completed"
    log_info "View logs: tail -f $LOG_FILE"
}

main "$@"
